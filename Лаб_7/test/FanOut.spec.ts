import { fanOut } from '../src/FanOut';

describe('Fan-Out (Demultiplexer) Unit Tests', () => {
  test('1. Паралельність: виконання N воркерами швидше, ніж 1 воркером', async () => {
    const taskDelay = 50;
    const tasksCount = 4;

    const slowProcess = async (task: number) => {
      await new Promise((resolve) => setTimeout(resolve, taskDelay));
      return task * 2;
    };

    // Замір для 4 воркерів
    const engineParallel = fanOut(slowProcess, 4);
    const startParallel = Date.now();
    for (let i = 1; i <= tasksCount; i++) {
      engineParallel.submit(i);
    }
    engineParallel.close();

    const parallelResults: number[] = [];
    for await (const res of engineParallel.results()) {
      parallelResults.push(res);
    }
    const parallelDuration = Date.now() - startParallel;

    // 4 задачі по 50ms паралельно мають виконатися ~50-80ms (замість 200ms)
    expect(parallelResults).toHaveLength(4);
    expect(parallelDuration).toBeLessThan(taskDelay * tasksCount * 0.7);
  });

  test('2. Безпека даних: відсутність гонок та подвійної обробки задач', async () => {
    const processedTasks = new Set<number>();
    let duplicateFound = false;

    const processFn = async (task: number) => {
      if (processedTasks.has(task)) {
        duplicateFound = true;
      }
      processedTasks.add(task);
      return task;
    };

    const engine = fanOut(processFn, 5);
    const tasksCount = 50;

    for (let i = 1; i <= tasksCount; i++) {
      engine.submit(i);
    }
    engine.close();

    const results: number[] = [];
    for await (const res of engine.results()) {
      results.push(res);
    }

    expect(duplicateFound).toBe(false);
    expect(results).toHaveLength(tasksCount);
    expect(processedTasks.size).toBe(tasksCount);
  });

  test('3. Graceful shutdown: завершення після обробки всіх задач', async () => {
    const processFn = async (task: string) => `Done: ${task}`;
    const engine = fanOut(processFn, 3);

    engine.submit('Task1');
    engine.submit('Task2');
    engine.close();

    const results: string[] = [];
    for await (const res of engine.results()) {
      results.push(res);
    }

    expect(results).toEqual(expect.arrayContaining(['Done: Task1', 'Done: Task2']));
    expect(() => engine.submit('Task3')).toThrow('Неможливо додати задачу: FanOut закритий (graceful shutdown)');
  });
});