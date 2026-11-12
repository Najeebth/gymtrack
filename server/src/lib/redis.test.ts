import { cacheAside, isRedisConnected, redis } from './redis.js';

describe('Redis Cache-Aside & Resilience', () => {
  afterAll(() => {
    if (redis) {
      redis.disconnect();
    }
  });

  it('should fall back to fetcher without crashing if Redis is offline', async () => {
    let fetcherCalled = false;
    const testData = { id: 1, name: 'Bench Press', muscleGroup: 'Chest' };

    const result = await cacheAside('test:fallback:key', 60, async () => {
      fetcherCalled = true;
      return testData;
    });

    expect(fetcherCalled).toBe(true);
    expect(result).toEqual(testData);
  });

  it('should handle null/undefined results from fetcher gracefully', async () => {
    const resultNull = await cacheAside('test:null:key', 60, async () => null);
    expect(resultNull).toBe(null);

    const resultUndefined = await cacheAside('test:undefined:key', 60, async () => undefined);
    expect(resultUndefined).toBe(undefined);
  });

  it('should expose connection status as a boolean', () => {
    const connected = isRedisConnected();
    expect(typeof connected).toBe('boolean');
  });
});

