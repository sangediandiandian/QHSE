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

@Module({
  imports: [IamModule, AuditModule, SessionModule],
  controllers: [AuthController, LegacyAuthController],
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
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
