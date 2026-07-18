import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const legacySalt = 'qhse-demo-auth-v1';
const algorithm = 'scrypt';
const changeRequiredAlgorithm = 'scrypt-change';

const derive = (password: string, salt: string) => scryptSync(password, salt, 64).toString('hex');

export function hashPassword(
  password: string,
  changeRequired = false,
  salt = randomBytes(16).toString('hex'),
) {
  return `${changeRequired ? changeRequiredAlgorithm : algorithm}$${salt}$${derive(password, salt)}`;
}

export function verifyPassword(password: string, encodedHash: string) {
  const parts = encodedHash.split('$');
  const encoded = parts.length === 3 && [algorithm, changeRequiredAlgorithm].includes(parts[0]);
  const expectedHex = encoded ? parts[2] : encodedHash;
  const actualHex = encoded ? derive(password, parts[1]) : derive(password, legacySalt);
  const actual = Buffer.from(actualHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function requiresPasswordChange(encodedHash: string) {
  return encodedHash.startsWith(`${changeRequiredAlgorithm}$`);
}
