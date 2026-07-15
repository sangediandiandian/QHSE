/** @jest-environment node */

import { UnauthorizedException } from '@nestjs/common';
import { IamService } from '../iam/iam.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  test('登录后返回随机会话和 QHSE 权限', () => {
    const service = new AuthService(new IamService());
    const result = service.login('qhse', 'ant.design');
    expect(result.accessToken).toHaveLength(64);
    expect(result.user).toMatchObject({
      username: 'qhse',
      dataScope: 'all',
    });
    expect(result.user.permissions).toEqual(expect.arrayContaining([
      'risk:read',
      'risk:assess',
      'risk:controls:update',
      'audit:read',
    ]));
    expect(service.authenticate(result.accessToken).userId).toBe('user-qhse');
  });

  test('装置负责人只获得授权区域', () => {
    const result = new AuthService(new IamService()).login('unit_manager', 'ant.design');
    expect(result.user).toMatchObject({
      dataScope: 'assigned_areas',
      areaIds: ['area-02'],
    });
  });

  test('错误密码被拒绝且不会返回用户信息', () => {
    expect(() => new AuthService(new IamService()).login('admin', 'wrong'))
      .toThrow(UnauthorizedException);
  });

  test('退出后会话立即失效', () => {
    const service = new AuthService(new IamService());
    const result = service.login('leader', 'ant.design');
    service.logout(result.accessToken);
    expect(() => service.authenticate(result.accessToken)).toThrow(UnauthorizedException);
  });
});
