/** @jest-environment node */

import { HttpException } from '@nestjs/common';
import { LoginAttemptLimiterService } from './login-attempt-limiter.service';

describe('LoginAttemptLimiterService', () => {
  test('同一客户端和账号连续失败五次后限制登录', () => {
    const service = new LoginAttemptLimiterService();
    for (let index = 0; index < 5; index += 1) {
      service.assertAllowed('127.0.0.1:admin', index);
      service.recordFailure('127.0.0.1:admin', index);
    }
    expect(() => service.assertAllowed('127.0.0.1:admin', 5)).toThrow(HttpException);
  });

  test('成功登录清除失败窗口且不同账号互不影响', () => {
    const service = new LoginAttemptLimiterService();
    service.recordFailure('client:admin', 0);
    service.clear('client:admin');
    expect(() => service.assertAllowed('client:admin', 1)).not.toThrow();
    expect(() => service.assertAllowed('client:operator', 1)).not.toThrow();
  });

  test('限制窗口到期后允许再次尝试', () => {
    const service = new LoginAttemptLimiterService();
    for (let index = 0; index < 5; index += 1) service.recordFailure('client:admin', index);
    expect(() => service.assertAllowed('client:admin', 15 * 60 * 1000 + 5)).not.toThrow();
  });
});
