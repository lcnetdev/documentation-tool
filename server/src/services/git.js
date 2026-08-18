const path = require('path');
const fs = require('fs');
const simpleGit = require('simple-git');
const config = require('../config');

/**
 * Per-invocation git config that authenticates HTTPS operations via an
 * Authorization header (passed as `git -c ...`), so the token is never
 * written to .git/config or any other file on disk.
 */
function authGitConfig() {
  if (!config.gitToken) return [];
  const user = config.gitUser || 'x-access-token';
  const basic = Buffer.from(`${user}:${config.gitToken}`).toString('base64');
  return [`http.extraHeader=Authorization: Basic ${basic}`];
}

class GitService {
  constructor(repoPath) {
    this.repoPath = repoPath;
    this.git = simpleGit({ baseDir: repoPath, config: authGitConfig() });
    this._scrubStoredCredentials();
  }

  /**
   * Remove any credentials previously embedded in remote URLs in
   * .git/config (older versions of this service wrote the token there,
   * where it was readable through the public file routes).
   */
  _scrubStoredCredentials() {
    try {
      const gitConfigPath = path.join(this.repoPath, '.git', 'config');
      if (!fs.existsSync(gitConfigPath)) return;

      const gitConfig = fs.readFileSync(gitConfigPath, 'utf-8');
      const scrubbed = gitConfig.replace(/(url\s*=\s*https:\/\/)[^@\s]+@/g, '$1');
      if (scrubbed !== gitConfig) {
        fs.writeFileSync(gitConfigPath, scrubbed, 'utf-8');
        console.log('[GitService] Removed embedded credentials from .git/config');
      }
    } catch (err) {
      console.error('[GitService] credential scrub failed:', err.message);
    }
  }

  /**
   * Clone a repo into docs/{repoName} if it doesn't already exist.
   * Authenticates via header (authGitConfig), keeping the URL clean.
   */
  async cloneIfMissing(repoName, remoteUrl) {
    const repoDir = path.join(config.docsDir, repoName);

    if (fs.existsSync(path.join(repoDir, '.git'))) {
      console.log(`Repository ${repoName} already exists, skipping clone.`);
      return;
    }

    console.log(`Cloning ${repoName} from ${remoteUrl}...`);
    await simpleGit({ config: authGitConfig() }).clone(remoteUrl, repoDir);
    console.log(`Successfully cloned ${repoName}.`);
  }

  /**
   * Remove credentials from text before it reaches logs or API responses:
   * userinfo in URLs (https://user:token@host) and the raw token itself,
   * which git may echo back in error messages.
   */
  static scrubSecrets(text) {
    let out = String(text).replace(/(https?:\/\/)[^@\s/]+@/g, '$1');
    if (config.gitToken) {
      out = out.split(config.gitToken).join('****');
    }
    return out;
  }

  _logGitError(label, err) {
    console.error(`[GitService] ${label}:`);
    console.error(`  message: ${GitService.scrubSecrets(err.message)}`);
    if (err.git) {
      if (err.git.stdErr) console.error(`  stderr: ${GitService.scrubSecrets(err.git.stdErr.trim())}`);
      if (err.git.stdOut) console.error(`  stdout: ${GitService.scrubSecrets(err.git.stdOut.trim())}`);
    }
    if (err.stack) console.error(`  stack: ${GitService.scrubSecrets(err.stack)}`);
  }

  /**
   * Extract a detailed error message including git stderr/stdout when available.
   * Credentials are scrubbed — this string is sent in API responses.
   */
  static formatError(err) {
    let msg = err.message || String(err);
    if (err.git) {
      if (err.git.stdErr) msg += '\ngit stderr: ' + err.git.stdErr.trim();
      if (err.git.stdOut) msg += '\ngit stdout: ' + err.git.stdOut.trim();
    }
    return GitService.scrubSecrets(msg);
  }

  /**
   * Check if a git error is a transient server/network issue (worth retrying as-is)
   * vs a non-fast-forward rejection (needs rebase).
   */
  _isTransientError(err) {
    const msg = (err.message || '') + (err.git?.stdErr || '');
    return /error:\s*5\d\d|Internal Server Error|Could not resolve host|Connection refused|Connection timed out|SSL|couldn't connect/i.test(msg);
  }

  _isNonFastForward(err) {
    const msg = (err.message || '') + (err.git?.stdErr || '');
    return /non-fast-forward|fetch first|rejected.*non-fast-forward/i.test(msg);
  }

  /**
   * Push with smart recovery:
   * - Transient errors (5xx, network): retry push up to 2 times with delay
   * - Non-fast-forward: stash, pull --rebase, pop stash, retry push
   * - Other errors: fail immediately
   */
  async _pushWithRetry() {
    if (!config.gitPushEnabled) {
      console.log('[GitService] Push skipped (GIT_PUSH_ENABLED=false)');
      return;
    }
    try {
      await this.git.push();
      return;
    } catch (pushError) {
      this._logGitError('Push failed', pushError);

      if (this._isTransientError(pushError)) {
        // Transient server/network error — wait and retry push directly
        for (let attempt = 1; attempt <= 2; attempt++) {
          console.log(`[GitService] Transient error detected, retrying push (attempt ${attempt}/2) after 3s...`);
          await new Promise(r => setTimeout(r, 3000));
          try {
            await this.git.push();
            return;
          } catch (retryError) {
            this._logGitError(`Retry push attempt ${attempt} failed`, retryError);
            if (attempt === 2) throw retryError;
          }
        }
      } else if (this._isNonFastForward(pushError)) {
        // Remote has new commits — stash, rebase, pop, push
        console.log('[GitService] Non-fast-forward detected, attempting stash + pull --rebase + push...');
        let stashed = false;
        try {
          const stashResult = await this.git.stash();
          stashed = !stashResult.includes('No local changes');
          if (stashed) console.log('[GitService] Stashed unstaged changes');
        } catch (stashError) {
          this._logGitError('Stash failed', stashError);
        }

        try {
          await this.git.pull({ '--rebase': 'true' });
        } catch (pullError) {
          this._logGitError('Pull --rebase failed', pullError);
          if (stashed) {
            try { await this.git.stash(['pop']); } catch (e) { this._logGitError('Stash pop failed after pull error', e); }
          }
          throw pullError;
        }

        if (stashed) {
          try {
            await this.git.stash(['pop']);
            console.log('[GitService] Restored stashed changes');
          } catch (popError) {
            this._logGitError('Stash pop failed', popError);
            throw popError;
          }
        }

        try {
          await this.git.push();
        } catch (retryError) {
          this._logGitError('Push after rebase failed', retryError);
          throw retryError;
        }
      } else {
        // Unknown error (auth failure, permission denied, etc.) — don't retry
        throw pushError;
      }
    }
  }

  /**
   * Stage a file, commit with the given message and author, then push.
   */
  async commitAndPush(filePath, message, username) {
    const authorName = username || 'Documentation Tool';
    const authorEmail = `${username || 'editor'}@documentation-tool`;

    console.log(`[GitService] commitAndPush: file="${filePath}", message="${message}", user="${username}", repo="${this.repoPath}"`);

    await this.git
      .addConfig('user.name', authorName)
      .addConfig('user.email', authorEmail);

    await this.git.add(filePath);
    await this.git.commit(message, filePath, {
      '--author': `${authorName} <${authorEmail}>`,
    });

    await this._pushWithRetry();

    const log = await this.git.log({ maxCount: 1 });
    return log.latest.hash;
  }

  /**
   * Return git status for the repository.
   */
  async status() {
    return await this.git.status();
  }

  /**
   * Return the most recent n commits.
   */
  async log(n = 20) {
    return await this.git.log({ maxCount: n });
  }

  /**
   * Pull latest changes from remote.
   */
  async pull() {
    return await this.git.pull();
  }

  /**
   * Create a new local branch and switch to it.
   */
  async checkoutNewBranch(branchName) {
    await this.git.checkoutLocalBranch(branchName);
  }

  /**
   * Push a new branch to remote with upstream tracking.
   */
  async pushNewBranch(branchName) {
    if (!config.gitPushEnabled) {
      console.log(`[GitService] Push skipped for branch "${branchName}" (GIT_PUSH_ENABLED=false)`);
      return;
    }
    try {
      await this.git.push(['-u', 'origin', branchName]);
    } catch (err) {
      this._logGitError(`pushNewBranch("${branchName}") failed`, err);
      throw err;
    }
  }

  /**
   * Stage all changes, commit, and push. Used for merge operations.
   */
  async commitAll(message, username) {
    const authorName = username || 'Documentation Tool';
    const authorEmail = `${username || 'editor'}@documentation-tool`;

    console.log(`[GitService] commitAll: message="${message}", user="${username}", repo="${this.repoPath}"`);

    await this.git
      .addConfig('user.name', authorName)
      .addConfig('user.email', authorEmail);

    await this.git.add('.');
    await this.git.commit(message, {
      '--author': `${authorName} <${authorEmail}>`
    });

    await this._pushWithRetry();

    const log = await this.git.log({ maxCount: 1 });
    return log.latest.hash;
  }
}

module.exports = GitService;
