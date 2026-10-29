import { FanInMultiplexer, Result } from '../src/FanIn';

// Допоміжна функція для створення затриманого джерела даних
async function* createStream(items: any[], delayMs: number): AsyncGenerator<any> {
  for (const item of items) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    yield item;
  }
}

// Допоміжна функція для створення джерела з помилкою
async function* createErrorStream(beforeError: string[], delayMs: number): AsyncGenerator<string> {
  for (const item of beforeError) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    yield item;
  }
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  throw new Error('Помилка потоку!');
}

describe('Fan-In (Multiplexer) Unit Tests', () => {
  test('1. Злиття трьох потоків в один із збереженням порядку відносно кожного потоку', async () => {
    const stream1 = createStream(['A1', 'A2'], 20);
    const stream2 = createStream(['B1', 'B2'], 30);
    const stream3 = createStream(['C1', 'C2'], 10);

    const merged = FanInMultiplexer.fanIn([stream1, stream2, stream3]);
    const results: string[] = [];

    for await (const result of merged) {
      if (result.ok) {
        results.push(result.value);
      }
    }

    expect(results).toHaveLength(6);
    expect(results).toContain('A1');
    expect(results).toContain('B1');
    expect(results).toContain('C1');

    expect(results.indexOf('A1')).toBeLessThan(results.indexOf('A2'));
    expect(results.indexOf('B1')).toBeLessThan(results.indexOf('B2'));
    expect(results.indexOf('C1')).toBeLessThan(results.indexOf('C2'));
  });

  test('2. Завершення вихідного потоку лише після завершення ВСІХ вхідних потоків', async () => {
    const stream1 = createStream([1], 10);
    const stream2 = createStream([2, 3], 50);

    const merged = FanInMultiplexer.fanIn([stream1, stream2]);
    const results: number[] = [];

    for await (const result of merged) {
      if (result.ok) {
        results.push(result.value);
      }
    }

    expect(results).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(results).toHaveLength(3);
  });

  test('3. Помилки одного входу не блокують інші входи (обгортка Result<T, E>)', async () => {
    const stream1 = createErrorStream(['A1'], 10);
    const stream2 = createStream(['B1', 'B2'], 20);

    const merged = FanInMultiplexer.fanIn([stream1, stream2]);
    const results: Result<string, Error>[] = [];

    for await (const result of merged) {
      results.push(result);
    }

    const successValues = results.filter((r) => r.ok).map((r) => (r as any).value);
    const errorCount = results.filter((r) => !r.ok).length;

    expect(successValues).toContain('A1');
    expect(successValues).toContain('B1');
    expect(successValues).toContain('B2');

    expect(errorCount).toBe(1);
  });
});



