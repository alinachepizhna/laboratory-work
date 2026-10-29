// Тип, що визначає можливі стани розмикача ланцюжка
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// Інтерфейс для налаштування параметрів CircuitBreaker
export interface CircuitBreakerConfig {
  failureThreshold: number;   // Поріг послідовних помилок для переходу в OPEN
  halfOpenMaxCalls: number;   // Максимальна кількість пробних викликів у стані HALF_OPEN
  openStateDuration: number;  // Тривалість перебування у стані OPEN (у мілісекундах)
  timeoutPerCall: number;     // Максимальний час очікування одного виклику (у мілісекундах)
}

export class CircuitBreaker {
  private _state: CircuitBreakerState = 'CLOSED'; // Початковий стан — ZAKRYTYI (CLOSED)
  private failureCount = 0;                       // Лічильник послідовних помилок
  private nextAttempt = 0;                        // Час (timestamp), після якого дозволено спробу у HALF_OPEN
  private halfOpenCalls = 0;                      // Кількість здійснених пробних викликів
  private successfulHalfOpenCalls = 0;            // Кількість успішних викликів у стані HALF_OPEN

  constructor(private config: CircuitBreakerConfig) {}

  /**
   * Повертає поточний стан Circuit Breaker, попередньо перевіряючи,
   * чи не час перейти зі стану OPEN у HALF_OPEN.
   */
  state(): CircuitBreakerState {
    if (this._state === 'OPEN' && Date.now() >= this.nextAttempt) {
      this._state = 'HALF_OPEN';
      this.halfOpenCalls = 0;
      this.successfulHalfOpenCalls = 0;
    }
    return this._state;
  }

  /**
   * Основний метод для виконання асинхронної функції через Circuit Breaker.
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.state();

    // Якщо стан OPEN — миттєво відхиляємо запит
    if (currentState === 'OPEN') {
      throw new Error('Circuit Breaker is OPEN');
    }

    // Якщо стан HALF_OPEN — перевіряємо ліміт пробних викликів
    if (currentState === 'HALF_OPEN') {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        throw new Error('Circuit Breaker is HALF_OPEN - max test calls reached');
      }
      this.halfOpenCalls++;
    }

    try {
      // Виконуємо функцію з обмеженням за часом (timeout)
      const result = await this.executeWithTimeout(fn, this.config.timeoutPerCall);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Приватний метод, який загортає виконання функції в таймер (тайм-аут).
   */
  private executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      // Створюємо таймер, який відхилить Promise за таймаутом
      const timer = setTimeout(() => reject(new Error('Timeout')), timeout);

      fn().then(
        (res) => {
          clearTimeout(timer); // Очищаємо таймер у разі успіху
          resolve(res);
        },
        (err) => {
          clearTimeout(timer); // Очищаємо таймер у разі помилки
          reject(err);
        }
      );
    });
  }

  /**
   * Обробник успішного виконання виклику.
   */
  private onSuccess() {
    if (this._state === 'HALF_OPEN') {
      this.successfulHalfOpenCalls++;
      // Якщо досягнуто необхідну кількість успішних викликів — повертаємося в CLOSED
      if (this.successfulHalfOpenCalls >= this.config.halfOpenMaxCalls) {
        this._state = 'CLOSED';
        this.failureCount = 0;
      }
    } else {
      // Скидаємо лічильник помилок для стану CLOSED
      this.failureCount = 0;
    }
  }

  /**
   * Обробник помилки при виконанні виклику.
   */
  private onFailure() {
    if (this._state === 'HALF_OPEN') {
      // Будь-яка помилка в HALF_OPEN одразу повертає в OPEN
      this.trip();
    } else {
      this.failureCount++;
      // Переходимо в OPEN при досягненні порогу помилок
      if (this.failureCount >= this.config.failureThreshold) {
        this.trip();
      }
    }
  }

  /**
   * Переводить Circuit Breaker у стан OPEN та розраховує час наступної спроби.
   */
  private trip() {
    this._state = 'OPEN';
    this.nextAttempt = Date.now() + this.config.openStateDuration;
  }
}