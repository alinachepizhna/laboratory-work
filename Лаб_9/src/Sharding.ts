import * as crypto from 'crypto';

export interface ShardNode<V> {
  id: string;
  storage: Map<string, V>;
}

export class ConsistentHashSharding<V> {
  private replicas: number;
  private ring: Map<number, string> = new Map(); // hashPosition -> shardId
  private sortedKeys: number[] = [];
  private nodes: Map<string, ShardNode<V>> = new Map();

  constructor(nodes: string[] = [], replicas: number = 3) {
    this.replicas = replicas;
    for (const node of nodes) {
      this.addShardNode(node);
    }
  }

  /**
   * Проста хеш-функція (FNV-1a / MD5 truncated), що повертає 32-бітний цілочисельний хеш
   */
  private hash(key: string): number {
    const hashHex = crypto.createHash('md5').update(key).digest('hex');
    return parseInt(hashHex.substring(0, 8), 16);
  }

  /**
   * Додати нову шарду-ноду до кільця
   */
  public addShardNode(nodeId: string): void {
    if (this.nodes.has(nodeId)) return;

    const newNode: ShardNode<V> = { id: nodeId, storage: new Map() };
    this.nodes.set(nodeId, newNode);

    for (let i = 0; i < this.replicas; i++) {
      const virtualNodeKey = `${nodeId}-replica-${i}`;
      const hashVal = this.hash(virtualNodeKey);
      this.ring.set(hashVal, nodeId);
    }

    this.updateSortedKeys();
  }

  /**
   * Видалити шарду-ноду з кільця
   */
  public removeShardNode(nodeId: string): void {
    if (!this.nodes.has(nodeId)) return;

    for (let i = 0; i < this.replicas; i++) {
      const virtualNodeKey = `${nodeId}-replica-${i}`;
      const hashVal = this.hash(virtualNodeKey);
      this.ring.delete(hashVal);
    }

    this.nodes.delete(nodeId);
    this.updateSortedKeys();
  }

  private updateSortedKeys(): void {
    this.sortedKeys = Array.from(this.ring.keys()).sort((a, b) => a - b);
  }

  /**
   * Визначити ID шарди для заданого ключа
   */
  public getShardId(key: string): string {
    if (this.ring.size === 0) {
      throw new Error('Кільце шард порожнє! Додайте хоча б одну шарду.');
    }

    const hashVal = this.hash(key);
    // Знаходимо першу ноду у кільці, позиція якої >= hashVal
    for (const ringKey of this.sortedKeys) {
      if (hashVal <= ringKey) {
        return this.ring.get(ringKey)!;
      }
    }

    // Якщо хеш більший за всі точки кільця — повертаємо першу ноду (замикання кільця)
    return this.ring.get(this.sortedKeys[0])!;
  }

  /**
   * Запис даних
   */
  public put(key: string, value: V): void {
    const shardId = this.getShardId(key);
    const node = this.nodes.get(shardId);
    if (node) {
      node.storage.set(key, value);
    }
  }

  /**
   * Читання даних
   */
  public get(key: string): V | undefined {
    const shardId = this.getShardId(key);
    const node = this.nodes.get(shardId);
    return node ? node.storage.get(key) : undefined;
  }

  /**
   * Отримати статистику розподілу даних
   */
  public getDistribution(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const [id, node] of this.nodes.entries()) {
      stats[id] = node.storage.size;
    }
    return stats;
  }

  /**
   * Візуалізація розподілу ключів у консоль
   */
  public visualize(): void {
    console.log('\n================ РАЗПОДІЛ КЛЮЧІВ ПО ШАРДАХ ================');
    for (const [id, node] of this.nodes.entries()) {
      console.log(`[Шарда ${id}]: ${node.storage.size} елементів`);
      const keysPreview = Array.from(node.storage.keys()).slice(0, 5).join(', ');
      console.log(`   Приклади ключів: ${keysPreview}${node.storage.size > 5 ? '...' : ''}`);
    }
    console.log('===========================================================\n');
  }
}