const path = require('path');
const fs = require('fs');
const simpleGit = require('simple-git');
const config = require('../config');

class GitService {
  constructor(repoPath) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
    this._ensureAuth();
  }

  /**
   * Ensure the origin remote URL has credentials embedded.
   * Handles repos that were manually cloned without a token in the URL.
   */
  _ensureAuth() {
    if (!config.gitToken) {
      console.warn('[GitService] _ensureAuth: No GIT_TOKEN configured, skipping auth injection');
      return;
    }

    try {
      const gitConfigPath = path.join(this.repoPath, '.git', 'config');
      if (!fs.existsSync(gitConfigPath)) {
        console.warn(`[GitService] _ensureAuth: No .git/config found at ${gitConfigPath}`);
        return;
      }

      let gitConfig = fs.readFileSync(gitConfigPath, 'utf-8');
      const urlMatch = gitConfig.match(/url\s*=\s*(https:\/\/[^\s]+)/);
      if (!urlMatch) {
        console.warn('[GitService] _ensureAuth: No https URL found in .git/config');
        return;
      }

      const currentUrl = urlMatch[1];
      // Skip if already has credentials
      if (currentUrl.includes('@')) return;

      const prefix = config.gitUser ? config.gitUser + ':' : '';
      const authUrl = currentUrl.replace('https://', `https://${prefix}${config.gitToken}@`);
      gitConfig = gitConfig.replace(currentUrl, authUrl);
      fs.writeFileSync(gitConfigPath, gitConfig, 'utf-8');
      console.log('[GitService] _ensureAuth: Injected credentials into remote URL');
    } catch (err) {
      console.error('[GitService] _ensureAuth failed:', err.message);
    }
  }

  /**
   * Clone a repo into docs/{repoName} if it doesn't already exist.
   * Uses GIT_TOKEN for authentication in the URL if available.
   */
  async cloneIfMissing(repoName, remoteUrl) {
    const repoDir = path.join(config.docsDir, repoName);

    if (fs.existsSync(path.join(repoDir, '.git'))) {
      console.log(`Repository ${repoName} already exists, skipping clone.`);
      return;
    }

    // Insert token into URL for authentication
    let authUrl = remoteUrl;
    if (config.gitToken) {
      authUrl = remoteUrl.replace(
        'https://',
        `https://${config.gitUser ? config.gitUser + ':' : ''}${config.gitToken}@`
      );
    }

    console.log(`Cloning ${repoName} from ${remoteUrl}...`);
    await simpleGit().clone(authUrl, repoDir);
    console.log(`Successfully cloned ${repoName}.`);
  }

  _logGitError(label, err) {
    console.error(`[GitService] ${label}:`);
    console.error(`  message: ${err.message}`);
    if (err.git) {
      if (err.git.stdErr) console.error(`  stderr: ${err.git.stdErr.trim()}`);
      if (err.git.stdOut) console.error(`  stdout: ${err.git.stdOut.trim()}`);
    }
    if (err.stack) console.error(`  stack: ${err.stack}`);
  }

  /**
   * Extract a detailed error message including git stderr/stdout when available.
   */
  static formatError(err) {
    let msg = err.message || String(err);
    if (err.git) {
      if (err.git.stdErr) msg += '\ngit stderr: ' + err.git.stdErr.trim();
      if (err.git.stdOut) msg += '\ngit stdout: ' + err.git.stdOut.trim();
    }
    return msg;
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
