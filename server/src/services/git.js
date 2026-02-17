const path = require('path');
const fs = require('fs');
const simpleGit = require('simple-git');
const config = require('../config');

class GitService {
  constructor(repoPath) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
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

  /**
   * Stage a file, commit with the given message and author, then push.
   * On push failure, attempts git pull --rebase then retries push once.
   */
  async commitAndPush(filePath, message, username) {
    await this.git.add(filePath);
    await this.git.commit(message, filePath, {
      '--author': `${username} <${username}@documentation-tool>`,
    });

    try {
      await this.git.push();
    } catch (pushError) {
      console.log('Push failed, attempting pull --rebase and retry...');
      await this.git.pull({ '--rebase': 'true' });
      await this.git.push();
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
}

module.exports = GitService;
