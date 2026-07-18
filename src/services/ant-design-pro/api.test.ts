import { request } from '@umijs/max';
import { exchangeOidcCompletion, getOidcLoginConfig } from './api';

jest.mock('@umijs/max', () => ({ request: jest.fn() }));

const requestMock = request as jest.Mock;

describe('authentication API', () => {
  beforeEach(() => {
    requestMock.mockReset();
    localStorage.clear();
  });

  test('读取统一登录配置', async () => {
    requestMock.mockResolvedValue({
      data: { enabled: true, label: '集团统一认证', localLoginEnabled: false },
    });

    await expect(getOidcLoginConfig()).resolves.toEqual({
      enabled: true,
      label: '集团统一认证',
      localLoginEnabled: false,
    });
    expect(requestMock).toHaveBeenCalledWith('/api/v1/auth/oidc/config', {
      method: 'GET',
      skipErrorHandler: true,
    });
  });

  test('一次性兑换完成后仅在浏览器保存 QHSE 会话令牌', async () => {
    requestMock.mockResolvedValue({
      data: { status: 'ok', accessToken: 'qhse-token', passwordChangeRequired: false },
    });

    await expect(exchangeOidcCompletion('completion-code')).resolves.toMatchObject({
      status: 'ok',
      accessToken: 'qhse-token',
    });
    expect(localStorage.getItem('qhse_access_token')).toBe('qhse-token');
    expect(requestMock).toHaveBeenCalledWith('/api/v1/auth/oidc/exchange', {
      method: 'POST',
      data: { completionCode: 'completion-code' },
    });
  });
});
