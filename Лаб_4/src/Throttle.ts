export interface ThrottleOptions {
  capacity: number;
  refillRate: number;
  refillIntervalMs?: number;
  leading?: boolean;
  mode?: 'drop' | 'queue';
}

export class Throttle {
  private capacity: number;
  private refillRate: number;
  private refillIntervalMs: number;
  private leading: boolean;
  private mode: 'drop' | 'queue';

  private tokens: number;
  private lastRefillTimestamp: number;
  private queue: Array<{
    fn: (...args: any[]) => any;
    args: any[];
    resolve: (val: any) => void;
    reject: (err: any) => void;
  }> = [];

  private timerId: NodeJS.Timeout | null = null;

  constructor(options: ThrottleOptions) {
    if (options.capacity <= 0 || options.refillRate <= 0) {
      throw new Error('capacity та refillRate повинні бути більшими за 0');
    }

    this.capacity = options.capacity;
    this.refillRate = options.refillRate;
    this.refillIntervalMs = options.refillIntervalMs ?? 1000;
    this.leading = options.leading ?? true;
    this.mode = options.mode ?? 'drop';

    this.tokens = this.leading ? this.capacity : 0;
    this.lastRefillTimestamp = Date.now();
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTimestamp;

    if (elapsed > 0) {
      const tokensToAdd = (elapsed / this.refillIntervalMs) * this.refillRate;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefillTimestamp = now;
    }
  }

  private processQueue(): void {
    this.refillTokens();

    while (this.queue.length > 0 && this.tokens >= 1) {
      const item = this.queue.shift();
      if (item) {
        this.tokens -= 1;
        try {
          const result = item.fn(...item.args);
          item.resolve(result);
        } catch (error) {
          item.reject(error);
        }
      }
    }

    if (this.queue.length > 0 && !this.timerId) {
      const timeToNextToken = (1 / this.refillRate) * this.refillIntervalMs;
      this.timerId = setTimeout(() => {
        this.timerId = null;
        this.processQueue();
      }, timeToNextToken);
    }
  }

  public throttle<T extends (...args: any[]) => any>(
    fn: T
  ): (...args: Parameters<T>) => Promise<ReturnType<T> | undefined> {
    return (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
      this.refillTokens();

      if (this.tokens >= 1) {
        this.tokens -= 1;
        try {
          const result = fn(...args);
          return Promise.resolve(result);
        } catch (error) {
          return Promise.reject(error);
        }
      }

      if (this.mode === 'queue') {
        return new Promise((resolve, reject) => {
          this.queue.push({ fn, args, resolve, reject });
          this.processQueue();
        });
      }

      return Promise.resolve(undefined);
    };
  }
}