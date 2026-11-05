export function createSerialQueue() {
  let previous = Promise.resolve();
  return function runExclusive<T>(task: () => Promise<T> | T): Promise<T> {
    const result = previous.then(task, task);
    previous = result.then(() => undefined, () => undefined);
    return result;
  };
}
