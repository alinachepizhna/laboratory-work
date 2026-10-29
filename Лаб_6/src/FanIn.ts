export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export class FanInMultiplexer {
  /**
   * Об'єднує декілька асинхронних джерел (AsyncIterable) в один вихідний асинхронний потік.
   * Вихідний потік автоматично закривається, коли завершуються УСІ вхідні потоки.
   */
  public static async *fanIn<T, E = Error>(
    inputs: AsyncIterable<T>[]
  ): AsyncGenerator<Result<T, E>, void, unknown> {
    if (inputs.length === 0) {
      return;
    }

    // Очередь для накопичення результатів з усіх потоків
    const queue: Result<T, E>[] = [];
    let resolveNext: (() => void) | null = null;
    let activeStreamsCount = inputs.length;

    const notify = () => {
      if (resolveNext) {
        const res = resolveNext;
        resolveNext = null;
        res();
      }
    };

    // Запускаємо читання з кожного джерела паралельно
    inputs.forEach(async (stream) => {
      try {
        for await (const item of stream) {
          queue.push({ ok: true, value: item });
          notify();
        }
      } catch (err: any) {
        // Помилка одного потоку обгортається в Result та додається в чергу
        queue.push({ ok: false, error: err as E });
        notify();
      } finally {
        activeStreamsCount--;
        notify();
      }
    });

    // Видаємо елементи з черги, поки є активні потоки або незабрані елементи
    while (activeStreamsCount > 0 || queue.length > 0) {
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          resolveNext = resolve;
        });
      }

      while (queue.length > 0) {
        const item = queue.shift()!;
        yield item;
      }
    }
  }
}