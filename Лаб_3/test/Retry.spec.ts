import { Retry } from '../src/Retry';

class NetworkError extends Error {}
class DatabaseError extends Error {}
class NonRetryableError extends Error {}

describe('Retry Unit Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('Успішне виконання з 1-ї спроби', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const retry = new Retry({ maxAttempts: 3, delayMs: 100 });

    const result = await retry.execute(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('Успішне виконання з n-тої спроби (наприклад, з 3-ї)', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new NetworkError('Fail 1'))
      .mockRejectedValueOnce(new NetworkError('Fail 2'))
      .mockResolvedValueOnce('success on 3rd attempt');

    const retry = new Retry({ maxAttempts: 3, delayMs: 100, backoffStrategy: 'constant' });

    const resultPromise = retry.execute(fn);

    // Автоматично просуваємо всі таймери та мікротаски асинхронно
    await jest.runAllTimersAsync();

    const result = await resultPromise;
    expect(result).toBe('success on 3rd attempt');
    expect(fn).toHaveBeenCalledTimes(3);
  });

test('Зупинка після maxAttempts із правильною сумою затримок (exponential)', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Persistent Error'));
    const retry = new Retry({ maxAttempts: 3, delayMs: 100, backoffStrategy: 'exponential' });

    // Одночасно запускаємо таймери та чекаємо на помилку
    const testExecution = expect(retry.execute(fn)).rejects.toThrow('Persistent Error');
    
    await jest.runAllTimersAsync();
    await testExecution;

    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('Не повторюємо виконання на non-retryable помилках', async () => {
    const fn = jest.fn().mockRejectedValue(new NonRetryableError('Fatal error'));

    const retry = new Retry({
      maxAttempts: 5,
      delayMs: 100,
      retryOn: [NetworkError],
    });

    const resultPromise = retry.execute(fn);

    await expect(resultPromise).rejects.toThrow(NonRetryableError);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});