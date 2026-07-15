/** @jest-environment node */

import {
  createDatabaseBackup,
  postgresChildEnvironment,
  verifyDatabaseBackup,
  type BackupManifest,
} from './database-backup';

class MemoryFiles {
  readonly values = new Map<string, Buffer>();
  readonly secured: string[] = [];

  async ensureDirectory() {}
  async secure(path: string) {
    this.secured.push(path);
  }
  async read(path: string) {
    const value = this.values.get(path);
    if (!value) throw new Error('missing file');
    return value;
  }
  async writeExclusive(path: string, value: string) {
    if (this.values.has(path)) throw new Error('file exists');
    this.values.set(path, Buffer.from(value));
  }
}

describe('database backup', () => {
  test('数据库凭据只通过子进程环境传递且备份产出完整清单', async () => {
    const files = new MemoryFiles();
    const calls: Array<{ command: string; arguments_: string[]; environment?: NodeJS.ProcessEnv }> =
      [];
    const run = jest.fn(async (command, arguments_, environment) => {
      calls.push({ command, arguments_, environment });
      if (command === 'pg_dump') {
        files.values.set(arguments_[arguments_.indexOf('--file') + 1], Buffer.from('custom-dump'));
      }
    });
    const result = await createDatabaseBackup(
      {
        databaseUrl: 'postgresql://backup:p%40ss@db.internal:5433/qhse?sslmode=require',
        backupDirectory: '/backups',
      },
      {
        files,
        run,
        now: () => new Date('2026-07-15T08:30:00.000Z'),
        id: () => '1234abcd',
      },
    );

    expect(result.dumpPath).toBe('/backups/qhse-20260715T083000000Z-1234abcd.dump');
    expect(result.manifest).toMatchObject({
      databaseName: 'qhse',
      sizeBytes: 11,
      fileName: 'qhse-20260715T083000000Z-1234abcd.dump',
    });
    expect(result.manifest.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(files.secured).toEqual([result.dumpPath]);
    expect(calls.map((item) => item.command)).toEqual(['pg_dump', 'pg_restore']);
    expect(calls[0].arguments_.join(' ')).not.toContain('p@ss');
    expect(calls[0].environment).toMatchObject({
      PGHOST: 'db.internal',
      PGPORT: '5433',
      PGUSER: 'backup',
      PGPASSWORD: 'p@ss',
      PGDATABASE: 'qhse',
      PGSSLMODE: 'require',
    });
    expect(calls[0].environment).not.toHaveProperty('DATABASE_URL');
  });

  test('校验清单、哈希和归档结构后才报告成功', async () => {
    const files = new MemoryFiles();
    const dumpPath = '/backups/qhse.dump';
    const manifestPath = `${dumpPath}.manifest.json`;
    const content = Buffer.from('custom-dump');
    files.values.set(dumpPath, content);
    files.values.set(
      manifestPath,
      Buffer.from(
        JSON.stringify({
          version: 1,
          kind: 'qhse-postgresql-backup',
          format: 'postgresql-custom',
          fileName: 'qhse.dump',
          databaseName: 'qhse',
          sizeBytes: 11,
          sha256: '04023b9631b41a84e8c4cb1404349dd89b98763d7686969c11289d25472f1571',
          createdAt: '2026-07-15T08:30:00.000Z',
        } satisfies BackupManifest),
      ),
    );
    const run = jest.fn(async () => undefined);

    const result = await verifyDatabaseBackup(dumpPath, manifestPath, { files, run });

    expect(result).toMatchObject({ verified: true, manifest: { databaseName: 'qhse' } });
    expect(run).toHaveBeenCalledWith('pg_restore', ['--list', dumpPath]);
  });

  test('哈希不匹配时禁止将归档标记为可恢复', async () => {
    const files = new MemoryFiles();
    const dumpPath = '/backups/qhse.dump';
    files.values.set(dumpPath, Buffer.from('damaged'));
    files.values.set(
      `${dumpPath}.manifest.json`,
      Buffer.from(
        JSON.stringify({
          version: 1,
          kind: 'qhse-postgresql-backup',
          format: 'postgresql-custom',
          fileName: 'qhse.dump',
          databaseName: 'qhse',
          sizeBytes: 7,
          sha256: '0'.repeat(64),
          createdAt: '2026-07-15T08:30:00.000Z',
        }),
      ),
    );
    const run = jest.fn(async () => undefined);

    await expect(verifyDatabaseBackup(dumpPath, undefined, { files, run })).rejects.toThrow(
      'backup checksum does not match manifest',
    );
    expect(run).not.toHaveBeenCalled();
  });

  test.each([
    'mysql://user:pass@db/qhse',
    'postgresql://user:pass@/qhse',
    'postgresql://db.internal',
  ])('拒绝无效 PostgreSQL 地址: %s', (value) =>
    expect(() => postgresChildEnvironment(value)).toThrow(),
  );
});
