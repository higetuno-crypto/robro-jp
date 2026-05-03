/**
 * 検索結果の in-memory キャッシュ（プロセスローカル・LRU近似）
 *
 * 目的：
 *  - 同一クエリの連打で Roblox API を叩かない（rate limit 保護）
 *  - サーバ再起動で消えてOK（揮発で十分）
 *
 * Vercel の serverless 環境では各 instance ごとに別キャッシュになるが、
 * それでも 1 instance 内での連打は防げる。
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

export class TtlCache<T> {
  private store = new Map<string, Entry<T>>();
  constructor(private maxEntries = 200, private ttlMs = 5 * 60 * 1000) {}

  get(key: string): T | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    // LRU近似：取り出して入れ直す
    this.store.delete(key);
    this.store.set(key, e);
    return e.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}
