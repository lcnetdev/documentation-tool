class WriteQueue {
  constructor() {
    this.chains = new Map();
  }

  enqueue(repoName, fn) {
    const previous = this.chains.get(repoName) || Promise.resolve();

    const next = previous.then(
      () => fn(),
      () => fn()
    );

    // Store the chain but swallow errors so future tasks aren't blocked
    this.chains.set(
      repoName,
      next.catch(() => {})
    );

    // Return the actual promise so the caller gets the result or error
    return next;
  }
}

module.exports = WriteQueue;
