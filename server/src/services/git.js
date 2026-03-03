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
    if (!config.gitToken) return;

    try {
      const gitConfigPath = path.join(this.repoPath, '.git', 'config');
      if (!fs.existsSync(gitConfigPath)) return;

      let gitConfig = fs.readFileSync(gitConfigPath, 'utf-8');
      const urlMatch = gitConfig.match(/url\s*=\s*(https:\/\/[^\s]+)/);
      if (!urlMatch) return;

      const currentUrl = urlMatch[1];
      // Skip if already has credentials
      if (currentUrl.includes('@')) return;

      const prefix = config.gitUser ? config.gitUser + ':' : '';
      const authUrl = currentUrl.replace('https://', `https://${prefix}${config.gitToken}@`);
      gitConfig = gitConfig.replace(currentUrl, authUrl);
      fs.writeFileSync(gitConfigPath, gitConfig, 'utf-8');
    } catch (err) {
      console.error('Failed to inject git credentials:', err.message);
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
   * Stage a file, commit with the given message and author, then push.
   * On push failure, attempts git pull --rebase then retries push once.
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

    try {
      await this.git.push();
    } catch (pushError) {
      this._logGitError('Push failed', pushError);
      console.log('[GitService] Attempting pull --rebase and retry...');
      try {
        await this.git.pull({ '--rebase': 'true' });
      } catch (pullError) {
        this._logGitError('Pull --rebase also failed', pullError);
        throw pullError;
      }
      try {
        await this.git.push();
      } catch (retryError) {
        this._logGitError('Retry push also failed', retryError);
        throw retryError;
      }
    }

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

    try {
      await this.git.push();
    } catch (pushError) {
      this._logGitError('Push failed', pushError);
      console.log('[GitService] Attempting pull --rebase and retry...');
      try {
        await this.git.pull({ '--rebase': 'true' });
      } catch (pullError) {
        this._logGitError('Pull --rebase also failed', pullError);
        throw pullError;
      }
      try {
        await this.git.push();
      } catch (retryError) {
        this._logGitError('Retry push also failed', retryError);
        throw retryError;
      }
    }

    const log = await this.git.log({ maxCount: 1 });
    return log.latest.hash;
  }
}

module.exports = GitService;
