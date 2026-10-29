export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  retries: number,
  delayMs: number,
  signal?: AbortSignal
): Promise<T> {
  let lastError: unknown;

  const controller = new AbortController();

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener(
        'abort',
        () => controller.abort(),
        { once: true }
      );
    }
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    if (controller.signal.aborted) {
      throw new Error('Операцію скасовано');
    }

    try {
      return await fn(controller.signal);
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, delayMs);

          const abortHandler = () => {
            clearTimeout(timer);
            reject(new Error('Операцію скасовано'));
          };

          controller.signal.addEventListener(
            'abort',
            abortHandler,
            { once: true }
          );
        });
      }
    }
  }

  throw lastError;
}