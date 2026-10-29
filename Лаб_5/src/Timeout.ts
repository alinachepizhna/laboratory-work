export class TimeoutError extends Error {
  constructor(message = 'Операція перевищила термін очікування (Timeout)') {
    super(message);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

export interface TimeoutOptions {
  signal?: AbortSignal;
}

/**
 * Виконує асинхронну функцію fn і відхиляє Promise,
 * якщо операція не завершилась за timeoutMs.
 *
 * AbortSignal дозволяє самій операції скасувати побічні ефекти.
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  options?: TimeoutOptions
): Promise<T> {
  if (timeoutMs < 0) {
    throw new RangeError('timeoutMs не може бути відʼємним');
  }

  const controller = new AbortController();
  const { signal } = controller;

  const externalSignal = options?.signal;

  const abortHandler = () => {
    controller.abort();
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', abortHandler, {
        once: true,
      });
    }
  }

  let timerId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      controller.abort();

      reject(
        new TimeoutError(
          `Операцію скасовано за тайм-аутом (${timeoutMs} мс)`
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fn(signal),
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timerId!);

    if (externalSignal) {
      externalSignal.removeEventListener('abort', abortHandler);
    }
  }
}
