const cacheStore = new Map();
const TTL_DEFAULT_MS = 15000; // 15 seconds default TTL

class FastCache {
  constructor(maxItems = 1000) {
    this.maxItems = maxItems;
  }

  get(key) {
    const item = cacheStore.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      cacheStore.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlMs = TTL_DEFAULT_MS) {
    if (cacheStore.size >= this.maxItems) {
      // Evict oldest 10%
      let count = Math.floor(this.maxItems * 0.1);
      for (const k of cacheStore.keys()) {
        cacheStore.delete(k);
        count--;
        if (count <= 0) break;
      }
    }
    cacheStore.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  delete(key) {
    cacheStore.delete(key);
  }

  invalidatePrefix(prefix) {
    for (const k of cacheStore.keys()) {
      if (k.startsWith(prefix)) {
        cacheStore.delete(k);
      }
    }
  }

  clear() {
    cacheStore.clear();
  }
}

const fastCache = new FastCache(2500);

module.exports = {
  fastCache,
  FastCache
};
