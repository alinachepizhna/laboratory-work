export type State = 'PENDING' | 'FULFILLED' | 'REJECTED';

export class Future<T> {
  private state: State = 'PENDING';
  private value?: T;
  private error?: any;

  private onFulfilledCallbacks: Array<(value: T) => void> = [];
  private onRejectedCallbacks: Array<(error: any) => void> = [];

  constructor(executor: (resolve: (val: T) => void, reject: (err: any) => void) => void) {
    const resolve = (val: T) => {
      if (this.state !== 'PENDING') return;
      this.state = 'FULFILLED';
      this.value = val;
      this.onFulfilledCallbacks.forEach((cb) => cb(val));
    };

    const reject = (err: any) => {
      if (this.state !== 'PENDING') return;
      this.state = 'REJECTED';
      this.error = err;
      this.onRejectedCallbacks.forEach((cb) => cb(err));
    };

    try {
      executor(resolve, reject);
    } catch (err) {
      reject(err);
    }
  }

  /**
   * Створення Future через асинхронне/синхронне виконання функції
   */
  public static submit<T>(fn: () => T | Promise<T>): Future<T> {
    return new Future<T>((resolve, reject) => {
      setTimeout(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      }, 0);
    });
  }

  /**
   * Ланцюжок обробки успішного значення
   */
  public then<R>(onFulfilled: (value: T) => R | Promise<R>): Future<R> {
    return new Future<R>((resolve, reject) => {
      const handleFulfilled = async (val: T) => {
        try {
          const res = await onFulfilled(val);
          resolve(res);
        } catch (err) {
          reject(err);
        }
      };

      if (this.state === 'FULFILLED') {
        setTimeout(() => handleFulfilled(this.value!), 0);
      } else if (this.state === 'PENDING') {
        this.onFulfilledCallbacks.push(handleFulfilled);
        this.onRejectedCallbacks.push((err) => reject(err));
      } else if (this.state === 'REJECTED') {
        reject(this.error);
      }
    });
  }

  /**
   * Обробка помилки
   */
  public catch<R = never>(onRejected: (error: any) => R | Promise<R>): Future<T | R> {
    return new Future<T | R>((resolve, reject) => {
      const handleRejected = async (err: any) => {
        try {
          const res = await onRejected(err);
          resolve(res);
        } catch (e) {
          reject(e);
        }
      };

      if (this.state === 'REJECTED') {
        setTimeout(() => handleRejected(this.error), 0);
      } else if (this.state === 'PENDING') {
        this.onRejectedCallbacks.push(handleRejected);
        this.onFulfilledCallbacks.push((val) => resolve(val));
      } else if (this.state === 'FULFILLED') {
        resolve(this.value!);
      }
    });
  }

  /**
   * Отримання значення з підтримкою тайм-ауту
   */
  public async get(timeoutMs?: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let timer: NodeJS.Timeout | null = null;

      if (timeoutMs !== undefined && timeoutMs > 0) {
        timer = setTimeout(() => {
          reject(new Error(`Future.get() timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }

      const cleanup = () => {
        if (timer) clearTimeout(timer);
      };

      if (this.state === 'FULFILLED') {
        cleanup();
        resolve(this.value!);
      } else if (this.state === 'REJECTED') {
        cleanup();
        reject(this.error);
      } else {
        this.onFulfilledCallbacks.push((val) => {
          cleanup();
          resolve(val);
        });
        this.onRejectedCallbacks.push((err) => {
          cleanup();
          reject(err);
        });
      }
    });
  }

  /**
   * Комбінатор all: чекає завершення всіх Future
   */
  public static all<T>(futures: Future<T>[]): Future<T[]> {
    return new Future<T[]>((resolve, reject) => {
      if (futures.length === 0) {
        resolve([]);
        return;
      }

      const results: T[] = new Array(futures.length);
      let completedCount = 0;

      futures.forEach((future, index) => {
        future
          .then((val) => {
            results[index] = val;
            completedCount++;
            if (completedCount === futures.length) {
              resolve(results);
            }
          })
          .catch((err) => {
            reject(err);
          });
      });
    });
  }

  /**
   * Комбінатор race: повертає перший завершений Future
   */
  public static race<T>(futures: Future<T>[]): Future<T> {
    return new Future<T>((resolve, reject) => {
      futures.forEach((future) => {
        future
          .then((val) => resolve(val))
          .catch((err) => reject(err));
      });
    });
  }
}