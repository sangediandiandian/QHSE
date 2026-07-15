import { Global, Module } from '@nestjs/common';
import { MemorySessionStore } from './memory-session.store';
import { RedisSessionStore } from './redis-session.store';
import { SessionStoreService } from './session-store.service';

@Global()
@Module({
  providers: [
    {
      provide: SessionStoreService,
      useFactory: () => {
        if (process.env.QHSE_SESSION_STORE !== 'redis') {
          return new SessionStoreService(new MemorySessionStore());
        }
        const url = process.env.QHSE_SESSION_REDIS_URL || process.env.QHSE_REDIS_URL;
        if (!url) {
          throw new Error(
            'QHSE_SESSION_STORE=redis requires QHSE_SESSION_REDIS_URL or QHSE_REDIS_URL',
          );
        }
        return new SessionStoreService(new RedisSessionStore(url));
      },
    },
  ],
  exports: [SessionStoreService],
})
export class SessionModule {}
