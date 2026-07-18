import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module';
import { IamModule } from '../iam/iam.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { LegacyAuthController } from './legacy-auth.controller';
import { LoginAttemptLimiterService } from './login-attempt-limiter.service';
import { SessionModule } from '../../infrastructure/session/session.module';
import { SessionStoreService } from '../../infrastructure/session/session-store.service';
import { IamService } from '../iam/iam.service';
import { OidcController } from './oidc/oidc.controller';
import { OidcFlowStoreService } from './oidc/oidc-flow-store.service';
import { MemoryOidcFlowStore } from './oidc/oidc-flow.store';
import { RedisOidcFlowStore } from './oidc/redis-oidc-flow.store';
import { OidcService, oidcSettingsFromEnvironment } from './oidc/oidc.service';

@Module({
  imports: [IamModule, AuditModule, SessionModule],
  controllers: [AuthController, LegacyAuthController, OidcController],
  providers: [
    LoginAttemptLimiterService,
    {
      provide: AuthService,
      inject: [IamService, LoginAttemptLimiterService, SessionStoreService],
      useFactory: (
        iam: IamService,
        limiter: LoginAttemptLimiterService,
        sessions: SessionStoreService,
      ) => new AuthService(iam, limiter, sessions),
    },
    {
      provide: OidcFlowStoreService,
      useFactory: () => {
        const useRedis =
          process.env.QHSE_OIDC_STORE === 'redis' ||
          (process.env.QHSE_OIDC_STORE === undefined && process.env.QHSE_SESSION_STORE === 'redis');
        if (!useRedis) {
          return new OidcFlowStoreService(new MemoryOidcFlowStore());
        }
        const url =
          process.env.QHSE_OIDC_REDIS_URL ||
          process.env.QHSE_SESSION_REDIS_URL ||
          process.env.QHSE_REDIS_URL;
        if (!url) {
          throw new Error(
            'Redis OIDC flow storage requires QHSE_OIDC_REDIS_URL, QHSE_SESSION_REDIS_URL, or QHSE_REDIS_URL',
          );
        }
        return new OidcFlowStoreService(new RedisOidcFlowStore(url));
      },
    },
    {
      provide: OidcService,
      inject: [AuthService, OidcFlowStoreService],
      useFactory: (auth: AuthService, flows: OidcFlowStoreService) =>
        new OidcService(auth, flows, oidcSettingsFromEnvironment()),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, OidcService],
})
export class AuthModule {}
