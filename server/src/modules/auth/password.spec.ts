/** @jest-environment node */

import { scryptSync } from 'node:crypto';
import { hashPassword, requiresPasswordChange, verifyPassword } from './password';

describe('password hashing', () => {
  test('同一密码使用独立随机盐并可安全校验', () => {
    const first = hashPassword('temporary-pass');
    const second = hashPassword('temporary-pass');

    expect(first).not.toBe(second);
    expect(first).not.toContain('temporary-pass');
    expect(verifyPassword('temporary-pass', first)).toBe(true);
    expect(verifyPassword('wrong-pass', first)).toBe(false);
  });

  test('兼容既有固定盐十六进制密码摘要', () => {
    const legacy = scryptSync('ant.design', 'qhse-demo-auth-v1', 64).toString('hex');

    expect(verifyPassword('ant.design', legacy)).toBe(true);
    expect(verifyPassword('wrong-pass', legacy)).toBe(false);
  });

  test('初始密码摘要可标记首次登录必须改密', () => {
    const encoded = hashPassword('TempPass-2026', true);
    expect(requiresPasswordChange(encoded)).toBe(true);
    expect(verifyPassword('TempPass-2026', encoded)).toBe(true);
    expect(requiresPasswordChange(hashPassword('NewPass-2026'))).toBe(false);
  });
});
