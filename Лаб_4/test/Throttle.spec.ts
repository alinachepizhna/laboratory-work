import { Throttle } from '../src/Throttle';

describe('Throttle Unit Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('Віконне обмеження: при 10 викликах за 1с і ліміті 3/с — виконується лише дозволена кількість (mode: drop)', async () => {
    const fn = jest.fn((i: number) => i);
    const throttler = new Throttle({
      capacity: 3,
      refillRate: 3,
      refillIntervalMs: 1000,
      mode: 'drop',
    });

    const throttledFn = throttler.throttle(fn);

    const results = [];
    for (let i = 1; i <= 10; i++) {
      results.push(await throttledFn(i));
    }

    expect(fn).toHaveBeenCalledTimes(3);
    expect(results.filter((r) => r !== undefined)).toHaveLength(3);
  });

  test('Режим leading: true — перший виклик виконується миттєво', async () => {
    const fn = jest.fn();
    const throttler = new Throttle({
      capacity: 1,
      refillRate: 1,
      leading: true,
      mode: 'drop',
    });

    const throttledFn = throttler.throttle(fn);

    await throttledFn();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('Режим leading: false — перші виклики чекають на поповнення токенів', async () => {
    const fn = jest.fn();
    const throttler = new Throttle({
      capacity: 1,
      refillRate: 1,
      refillIntervalMs: 1000,
      leading: false,
      mode: 'drop',
    });

    const throttledFn = throttler.throttle(fn);

    await throttledFn();
    expect(fn).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(1000);

    await throttledFn();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('Режим queue: збереження порядку виконання викликів та обробка надлишку', async () => {
    const executionOrder: number[] = [];
    const fn = jest.fn((id: number) => {
      executionOrder.push(id);
    });

    const throttler = new Throttle({
      capacity: 1,
      refillRate: 1,
      refillIntervalMs: 500,
      mode: 'queue',
    });

    const throttledFn = throttler.throttle(fn);

    throttledFn(1);
    throttledFn(2);
    throttledFn(3);

    expect(fn).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(500);
    expect(fn).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(500);
    expect(fn).toHaveBeenCalledTimes(3);

    expect(executionOrder).toEqual([1, 2, 3]);
  });
});