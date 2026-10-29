import { ConsistentHashSharding } from '../src/Sharding';

describe('Sharding (Consistent Hashing) Unit Tests', () => {
  test('1. Коректність get після put', () => {
    const cluster = new ConsistentHashSharding<string>(['shard-1', 'shard-2', 'shard-3']);

    cluster.put('user:1001', 'Alice');
    cluster.put('user:1002', 'Bob');
    cluster.put('order:500', 'Laptop');

    expect(cluster.get('user:1001')).toBe('Alice');
    expect(cluster.get('user:1002')).toBe('Bob');
    expect(cluster.get('order:500')).toBe('Laptop');
    expect(cluster.get('non_existing_key')).toBeUndefined();
  });

  test('2. Рівномірність розподілу для випадкових ключів', () => {
    const cluster = new ConsistentHashSharding<number>(
      ['shard-A', 'shard-B', 'shard-C', 'shard-D'],
      20 // збільшена кількість віртуальних нод для рівномірності
    );

    const totalKeys = 1000;
    for (let i = 0; i < totalKeys; i++) {
      const randomKey = `key_${Math.random()}_${i}`;
      cluster.put(randomKey, i);
    }

    const dist = cluster.getDistribution();
    const expectedAvg = totalKeys / 4; // ~250 ключів на шарду

    cluster.visualize();

    for (const shardId in dist) {
      const count = dist[shardId];
      // Відхилення від середнього не більше ніж 35%
      expect(count).toBeGreaterThan(expectedAvg * 0.65);
      expect(count).toBeLessThan(expectedAvg * 1.35);
    }
  });

  test('3. Стабільність при додаванні ноди (Consistent Hashing remapping < 100%)', () => {
    const initialNodes = ['node-1', 'node-2', 'node-3'];
    const cluster = new ConsistentHashSharding<string>(initialNodes, 10);

    const totalKeys = 500;
    const keyMapBefore = new Map<string, string>();

    for (let i = 0; i < totalKeys; i++) {
      const key = `item_${i}`;
      keyMapBefore.set(key, cluster.getShardId(key));
    }

    // Додаємо 4-ту шарду
    cluster.addShardNode('node-4');

    let remappedKeys = 0;
    for (let i = 0; i < totalKeys; i++) {
      const key = `item_${i}`;
      const newShard = cluster.getShardId(key);
      if (newShard !== keyMapBefore.get(key)) {
        remappedKeys++;
      }
    }

    const remappedPercentage = (remappedKeys / totalKeys) * 100;
    console.log(`Частка перемаплених ключів при додаванні ноди: ${remappedPercentage.toFixed(2)}%`);

    // При послідовному шардуванні (mod N) було б зміщено ~75-100% ключів.
    // При consistent hashing перемаплюється близька до K/N частина ключів (тобто близько 25%).
    expect(remappedPercentage).toBeLessThan(45);
  });
});