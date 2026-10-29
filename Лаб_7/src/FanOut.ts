export interface FanOutEngine<TTask, TResult> {
  submit(task: TTask): void;
  close(): void;
  results(): AsyncIterable<TResult>;
}

export function fanOut<TTask, TResult>(
  processFn: (task: TTask) => Promise<TResult>,
  workersCount: number
): FanOutEngine<TTask, TResult> {
  const taskQueue: TTask[] = [];
  const resultQueue: TResult[] = [];

  let isClosed = false;
  let activeWorkers = 0;

  const taskWaiters: Array<() => void> = [];
  const resultWaiters: Array<() => void> = [];

  const notifyTask = () => {
    while (taskWaiters.length > 0) {
      const resolve = taskWaiters.shift();
      if (resolve) resolve();
    }
  };

  const notifyResult = () => {
    while (resultWaiters.length > 0) {
      const resolve = resultWaiters.shift();
      if (resolve) resolve();
    }
  };

  async function workerLoop() {
    activeWorkers++;
    try {
      while (true) {
        while (taskQueue.length === 0) {
          if (isClosed) {
            return;
          }
          await new Promise<void>((resolve) => {
            taskWaiters.push(resolve);
          });
        }

        const task = taskQueue.shift();
        if (task !== undefined) {
          const res = await processFn(task);
          resultQueue.push(res);
          notifyResult();
        }
      }
    } finally {
      activeWorkers--;
      notifyResult();
      notifyTask();
    }
  }

  // Запускаємо пул воркерів
  for (let i = 0; i < workersCount; i++) {
    workerLoop();
  }

  return {
    submit(task: TTask) {
      if (isClosed) {
        throw new Error('Неможливо додати задачу: FanOut закритий (graceful shutdown)');
      }
      taskQueue.push(task);
      notifyTask();
    },

    close() {
      isClosed = true;
      notifyTask();
    },

    async *results(): AsyncIterable<TResult> {
      while (activeWorkers > 0 || taskQueue.length > 0 || resultQueue.length > 0) {
        while (resultQueue.length > 0) {
          yield resultQueue.shift()!;
        }

        if (activeWorkers > 0 || taskQueue.length > 0) {
          await new Promise<void>((resolve) => {
            resultWaiters.push(resolve);
          });
        }
      }

      // Видаємо залишки, якщо вони є
      while (resultQueue.length > 0) {
        yield resultQueue.shift()!;
      }
    }
  };
}