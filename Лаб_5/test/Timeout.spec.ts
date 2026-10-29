import { withTimeout, TimeoutError } from '../src/Timeout';
import { withRetry } from '../src/Retry';

describe('Timeout Unit Tests (Лабораторна робота №5)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('1. Успішна операція до тайм-ауту', async () => {
    const fastOperation = jest.fn(async () => 'успіх');

    const promise = withTimeout(
      async () => {
        return await fastOperation();
      },
      1000
    );

    await expect(promise).resolves.toBe('успіх');
    expect(fastOperation).toHaveBeenCalledTimes(1);
  });

  test('2. Перевищення тайм-ауту — повертається TimeoutError та відміняються побічні ефекти', async () => {
    let sideEffectOccurred = false;

    const slowOperation = (signal: AbortSignal) =>
      new Promise<string>((resolve) => {
        const timer = setTimeout(() => {
          if (!signal.aborted) {
            sideEffectOccurred = true;
            resolve('завершено');
          }
        }, 2000);

        signal.addEventListener('abort', () => {
          clearTimeout(timer);
        });
      });

    const promise = withTimeout(
      (signal) => slowOperation(signal),
      1000
    );

    jest.advanceTimersByTime(1000);

    await expect(promise).rejects.toThrow(TimeoutError);

    jest.advanceTimersByTime(2000);

    expect(sideEffectOccurred).toBe(false);
  });

test('3. Timeout + Retry — загальний час обмежений одним timeout', async () => {
  let attempts = 0;

  const operation = (signal: AbortSignal) =>
    new Promise<string>((resolve, reject) => {
      attempts++;

      const timer = setTimeout(() => {
        if (!signal.aborted) {
          resolve('ok');
        }
      }, 2000);

      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new Error('Операцію скасовано'));
      });
    });

  const promise = withTimeout(
    (signal) =>
      withRetry(
        (retrySignal) => operation(retrySignal),
        3,
        100,
        signal
      ),
    1000
  );

  // Реєструємо очікування rejection ДО переміщення таймерів
  const result = expect(promise).rejects.toThrow(TimeoutError);

  await jest.advanceTimersByTimeAsync(1000);

  await result;

  expect(attempts).toBe(1);
});
});