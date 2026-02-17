import WriteQueue from '../services/writeQueue.js';

describe('WriteQueue', () => {
  it('executes tasks in order for the same repo', async () => {
    const queue = new WriteQueue();
    const order = [];

    const p1 = queue.enqueue('repo-a', async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push('first');
      return 'first';
    });

    const p2 = queue.enqueue('repo-a', async () => {
      order.push('second');
      return 'second';
    });

    const p3 = queue.enqueue('repo-a', async () => {
      order.push('third');
      return 'third';
    });

    await Promise.all([p1, p2, p3]);
    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('does not block subsequent tasks when one fails', async () => {
    const queue = new WriteQueue();
    const results = [];

    const p1 = queue.enqueue('repo-a', async () => {
      throw new Error('task 1 failed');
    });

    const p2 = queue.enqueue('repo-a', async () => {
      results.push('task2-ok');
      return 'done';
    });

    await expect(p1).rejects.toThrow('task 1 failed');

    const result = await p2;
    expect(result).toBe('done');
    expect(results).toEqual(['task2-ok']);
  });

  it('runs tasks for different repos in parallel', async () => {
    const queue = new WriteQueue();
    const timeline = [];

    const p1 = queue.enqueue('repo-a', async () => {
      timeline.push('a-start');
      await new Promise((r) => setTimeout(r, 50));
      timeline.push('a-end');
    });

    const p2 = queue.enqueue('repo-b', async () => {
      timeline.push('b-start');
      await new Promise((r) => setTimeout(r, 10));
      timeline.push('b-end');
    });

    await Promise.all([p1, p2]);

    const aEndIdx = timeline.indexOf('a-end');
    const bStartIdx = timeline.indexOf('b-start');
    const bEndIdx = timeline.indexOf('b-end');

    expect(bStartIdx).toBeLessThan(aEndIdx);
    expect(bEndIdx).toBeLessThan(aEndIdx);
  });

  it('propagates errors to callers', async () => {
    const queue = new WriteQueue();

    const promise = queue.enqueue('repo-a', async () => {
      throw new Error('something went wrong');
    });

    await expect(promise).rejects.toThrow('something went wrong');
  });

  it('returns the value from the task function', async () => {
    const queue = new WriteQueue();

    const result = await queue.enqueue('repo-a', async () => {
      return { status: 'ok', count: 42 };
    });

    expect(result).toEqual({ status: 'ok', count: 42 });
  });
});
