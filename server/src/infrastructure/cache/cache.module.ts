import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { MemoryCacheStore } from './memory-cache.store';
import { RedisCacheStore } from './redis-cache.store';

@Global()
@Module({
  providers: [
    {
      provide: CacheService,
      useFactory: () => {
        if (process.env.QHSE_CACHE !== 'redis') return new CacheService(new MemoryCacheStore());
        const url = process.env.QHSE_REDIS_URL;
        if (!url) throw new Error('QHSE_CACHE=redis requires QHSE_REDIS_URL');
        return new CacheService(new RedisCacheStore(url));
      },
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}
