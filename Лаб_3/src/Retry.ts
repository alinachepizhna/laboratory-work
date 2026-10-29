export type BackoffStrategy = 'constant' | 'exponential' | 'exponentialJitter';

export interface RetryOptions {
  /** Максимальна кількість спроб виконання */
  maxAttempts: number;
  /** Базова затримка в мілісекундах між спробами */
  delayMs: number;
  /** Стратегія розрахунку паузи між спробами */
  backoffStrategy?: BackoffStrategy;
  /** Список класів помилок або критеріїв, за яких дозволено повтор */
  retryOn?: Array<new (...args: any[]) => Error> | ((error: any) => boolean);
}

export class Retry {
  private maxAttempts: number;
  private delayMs: number;
  private backoffStrategy: BackoffStrategy;
  private retryOn?: Array<new (...args: any[]) => Error> | ((error: any) => boolean);

  constructor(options: RetryOptions) {
    if (options.maxAttempts < 1) {
      throw new Error('maxAttempts повинно бути не менше 1');
    }
    this.maxAttempts = options.maxAttempts;
    this.delayMs = options.delayMs;
    this.backoffStrategy = options.backoffStrategy ?? 'constant';
    this.retryOn = options.retryOn;
  }

  /**
   * Обчислює затримку перед наступною спробою
   */
  public calculateDelay(attempt: number): number {
    switch (this.backoffStrategy) {
      case 'constant':
        return this.delayMs;

      case 'exponential':
        // delayMs * 2^(attempt - 1)
        return this.delayMs * Math.pow(2, attempt - 1);

      case 'exponentialJitter': {
        // Експоненціальна затримка з випадковим відхиленням (Jitter)
        const expDelay = this.delayMs * Math.pow(2, attempt - 1);
        return Math.floor(Math.random() * expDelay);
      }

      default:
        return this.delayMs;
    }
  }

  /**
   * Перевіряє, чи є помилка повторюваною (retryable)
   */
  private isRetryable(error: any): boolean {
    if (!this.retryOn) {
      return true; // За замовчуванням повторюємо при будь-якій помилці
    }

    if (typeof this.retryOn === 'function') {
      return this.retryOn(error);
    }

    if (Array.isArray(this.retryOn)) {
      return this.retryOn.some((ErrorClass) => error instanceof ErrorClass);
    }

    return true;
  }

  /**
   * Допоміжна функція для створення паузи
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Виконує функцію fn з підтримкою повторних спроб
   */
  public async execute<T>(fn: () => Promise<T> | T): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        // Якщо це була остання спроба або помилка не підлягає повтору — кидаємо помилку далі
        if (attempt === this.maxAttempts || !this.isRetryable(error)) {
          throw error;
        }

        // Обчислюємо затримку та чекаємо перед наступною спробою
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }
}