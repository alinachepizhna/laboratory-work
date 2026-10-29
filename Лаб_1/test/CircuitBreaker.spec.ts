import { CircuitBreaker } from '../src/CircuitBreaker';

describe('CircuitBreaker Unit Tests', () => {
  // Базова конфігурація для проведення тестування
  const config = {
    failureThreshold: 3,    // Поріг помилок для переходу в OPEN
    halfOpenMaxCalls: 2,    // Кількість тестових викликів у HALF_OPEN
    openStateDuration: 1000,// Час затримки в стані OPEN (мс)
    timeoutPerCall: 200,    // Граничний таймаут одного виклику (мс)
  };

  // Вмикаємо фейкові таймери перед кожним тестом
  beforeEach(() => {
    jest.useFakeTimers();
  });

  // Очищаємо та повертаємо реальні таймери після кожного тесту
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('Початковий стан має бути CLOSED', () => {
    const cb = new CircuitBreaker(config);
    expect(cb.state()).toBe('CLOSED');
  });

  test('Перехід у стан OPEN після failureThreshold послідовних збоїв', async () => {
    const cb = new CircuitBreaker(config);
    const mockFailingFn = jest.fn().mockRejectedValue(new Error('Network error'));

    // Перші дві помилки не повинні розмикати ланцюг
    for (let i = 0; i < 2; i++) {
      await expect(cb.call(mockFailingFn)).rejects.toThrow('Network error');
      expect(cb.state()).toBe('CLOSED');
    }

    // Третя помилка переводить Circuit Breaker у стан OPEN
    await expect(cb.call(mockFailingFn)).rejects.toThrow('Network error');
    expect(cb.state()).toBe('OPEN');
  });

test('Блокування викликів у стані OPEN до закінчення openStateDuration', async () => {
    const cb = new CircuitBreaker(config);
    const mockFailingFn = jest.fn().mockRejectedValue(new Error('Fail'));
    const mockService = jest.fn().mockResolvedValue('OK');

    // Примусово переводимо в OPEN
    for (let i = 0; i < 3; i++) {
      await expect(cb.call(mockFailingFn)).rejects.toThrow();
    }
    expect(cb.state()).toBe('OPEN');

    // Виклики мають блокуватися без виконання цільової функції
    await expect(cb.call(mockService)).rejects.toThrow('Circuit Breaker is OPEN');
    expect(mockService).not.toHaveBeenCalled();

    // Просуваємо час на 500 мс — стан все ще має бути OPEN
    jest.advanceTimersByTime(500);
    await expect(cb.call(mockService)).rejects.toThrow('Circuit Breaker is OPEN');

    // Просуваємо час ще на 500 мс (загалом 1000 мс) — перехід у HALF_OPEN
    jest.advanceTimersByTime(500);
    expect(cb.state()).toBe('HALF_OPEN');
  });

  test('Поведінка HALF_OPEN: повернення в CLOSED при успішних пробних викликах', async () => {
    const cb = new CircuitBreaker(config);
    const mockFailingFn = jest.fn().mockRejectedValue(new Error('Fail'));
    const mockSuccessFn = jest.fn().mockResolvedValue('Success payload');

    for (let i = 0; i < 3; i++) {
      await expect(cb.call(mockFailingFn)).rejects.toThrow();
    }
    jest.advanceTimersByTime(1000);
    expect(cb.state()).toBe('HALF_OPEN');

    // Перший успішний пробний виклик
    const res1 = await cb.call(mockSuccessFn);
    expect(res1).toBe('Success payload');
    expect(cb.state()).toBe('HALF_OPEN');

    // Другий успішний пробний виклик відновлює стан CLOSED
    const res2 = await cb.call(mockSuccessFn);
    expect(res2).toBe('Success payload');
    expect(cb.state()).toBe('CLOSED');
  });

  test('Поведінка HALF_OPEN: повернення в OPEN при першому ж збої', async () => {
    const cb = new CircuitBreaker(config);
    const mockFailingFn = jest.fn().mockRejectedValue(new Error('Fail'));
    const mockSuccessFn = jest.fn().mockResolvedValue('Success');

    for (let i = 0; i < 3; i++) {
      await expect(cb.call(mockFailingFn)).rejects.toThrow();
    }
    jest.advanceTimersByTime(1000);
    expect(cb.state()).toBe('HALF_OPEN');

    await cb.call(mockSuccessFn);
    expect(cb.state()).toBe('HALF_OPEN');

    // Будь-яка помилка в HALF_OPEN знову розмикає ланцюг у стан OPEN
    await expect(cb.call(mockFailingFn)).rejects.toThrow();
    expect(cb.state()).toBe('OPEN');
  });


  test('Врахування тайм-ауту окремого виклику (функція зависає)', async () => {
    const cb = new CircuitBreaker(config);

    // Функція, яка симулює зависання тривалістю 1000 мс
    const hangingFn = () =>
      new Promise((resolve) => {
        setTimeout(() => resolve('Too late'), 1000);
      });

    // Огортаємо очікування помилки перед просуванням таймера
    const assertionPromise = expect(cb.call(hangingFn)).rejects.toThrow('Timeout');

    // Асинхронно просуваємо фейкові таймери на 200 мс (ліміт таймауту)
    await jest.advanceTimersByTimeAsync(200);

    // Дочікуємося виконання перевірки та підтвердження помилки 'Timeout'
    await assertionPromise;
  });
});