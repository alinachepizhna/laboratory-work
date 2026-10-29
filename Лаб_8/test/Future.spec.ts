import { Future } from '../src/Future';

describe('Future (Promise) Unit Tests', () => {
  test('1. Успішне виконання та отримання значення через submit, then та get', async () => {
    const future = Future.submit(() => 'Hello Future');
    const value = await future.get();
    expect(value).toBe('Hello Future');

    const transformedFuture = future.then((val) => val.toUpperCase());
    const transformedValue = await transformedFuture.get();
    expect(transformedValue).toBe('HELLO FUTURE');
  });

  test('2. Пропагація помилок та обробка через catch', async () => {
    const future = Future.submit(() => {
      throw new Error('Обчислити не вдалося');
    });

    let caughtError: Error | null = null;
    await future.catch((err) => {
      caughtError = err;
    }).get();

    expect(caughtError).not.toBeNull();
    expect((caughtError as unknown as Error).message).toBe('Обчислити не вдалося');
  });

  test('3. Комбінатори: all чекає всі, race повертає перший завершений', async () => {
    // Тест all
    const f1 = Future.submit(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return 10;
    });
    const f2 = Future.submit(async () => {
      await new Promise((r) => setTimeout(r, 40));
      return 20;
    });

    const allFuture = Future.all([f1, f2]);
    const allResults = await allFuture.get();
    expect(allResults).toEqual([10, 20]);

    // Тест race
    const fast = Future.submit(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 'fast';
    });
    const slow = Future.submit(async () => {
      await new Promise((r) => setTimeout(r, 80));
      return 'slow';
    });

    const raceFuture = Future.race([fast, slow]);
    const raceResult = await raceFuture.get();
    expect(raceResult).toBe('fast');
  });

  test('4. Тайм-аут get(timeout)', async () => {
    const slowFuture = Future.submit(async () => {
      await new Promise((r) => setTimeout(r, 150));
      return 'Запізно';
    });

    await expect(slowFuture.get(50)).rejects.toThrow('Future.get() timed out after 50ms');
  });
});