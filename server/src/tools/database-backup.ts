import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { spawn } from 'node:child_process';

export interface DatabaseBackupConfig {
  databaseUrl: string;
  backupDirectory: string;
}

export interface BackupManifest {
  version: 1;
  kind: 'qhse-postgresql-backup';
  format: 'postgresql-custom';
  fileName: string;
  databaseName: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

interface BackupFiles {
  ensureDirectory(path: string): Promise<void>;
  secure(path: string): Promise<void>;
  read(path: string): Promise<Buffer>;
  writeExclusive(path: string, value: string): Promise<void>;
}

type ProcessRunner = (
  command: 'pg_dump' | 'pg_restore',
  arguments_: string[],
  environment?: NodeJS.ProcessEnv,
) => Promise<void>;

interface BackupDependencies {
  files: BackupFiles;
  run: ProcessRunner;
  now: () => Date;
  id: () => string;
}

const nodeFiles: BackupFiles = {
  async ensureDirectory(path) {
    await mkdir(path, { recursive: true, mode: 0o700 });
  },
  async secure(path) {
    await chmod(path, 0o600);
  },
  async read(path) {
    return readFile(path);
  },
  async writeExclusive(path, value) {
    await writeFile(path, value, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  },
};

const runProcess: ProcessRunner = (command, arguments_, environment) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, arguments_, {
      env: environment,
      stdio: 'ignore',
    });
    child.once('error', (error: NodeJS.ErrnoException) => {
      reject(
        new Error(
          error.code === 'ENOENT'
            ? `${command} is not installed or not available on PATH`
            : `${command} could not start`,
        ),
      );
    });
    child.once('close', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} failed with exit code ${code ?? 'unknown'}`));
    });
  });

const defaults: BackupDependencies = {
  files: nodeFiles,
  run: runProcess,
  now: () => new Date(),
  id: () => randomUUID().slice(0, 8),
};

function dependencies(overrides: Partial<BackupDependencies>) {
  return { ...defaults, ...overrides };
}

function checksum(value: Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function parseManifest(value: Buffer): BackupManifest {
  const manifest = JSON.parse(value.toString('utf8')) as Partial<BackupManifest>;
  if (
    manifest.version !== 1 ||
    manifest.kind !== 'qhse-postgresql-backup' ||
    manifest.format !== 'postgresql-custom' ||
    typeof manifest.fileName !== 'string' ||
    typeof manifest.databaseName !== 'string' ||
    !Number.isSafeInteger(manifest.sizeBytes) ||
    (manifest.sizeBytes || 0) < 1 ||
    typeof manifest.sha256 !== 'string' ||
    !/^[0-9a-f]{64}$/.test(manifest.sha256) ||
    typeof manifest.createdAt !== 'string'
  ) {
    throw new Error('backup manifest is invalid');
  }
  return manifest as BackupManifest;
}

export function databaseBackupConfigFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): DatabaseBackupConfig {
  if (!environment.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return {
    databaseUrl: environment.DATABASE_URL,
    backupDirectory: resolve(environment.QHSE_BACKUP_DIR || '.qhse-data/backups'),
  };
}

export function postgresChildEnvironment(
  databaseUrl: string,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new Error('DATABASE_URL must be a PostgreSQL URL');
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!databaseName) throw new Error('DATABASE_URL must include a database name');
  const childEnvironment = { ...environment };
  delete childEnvironment.DATABASE_URL;
  Object.assign(childEnvironment, {
    PGAPPNAME: 'qhse-backup',
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: databaseName,
  });
  const sslMode = url.searchParams.get('sslmode');
  if (sslMode) childEnvironment.PGSSLMODE = sslMode;
  return { environment: childEnvironment, databaseName };
}

export async function createDatabaseBackup(
  config: DatabaseBackupConfig,
  overrides: Partial<BackupDependencies> = {},
) {
  const services = dependencies(overrides);
  const connection = postgresChildEnvironment(config.databaseUrl);
  const createdAt = services.now().toISOString();
  const timestamp = createdAt.replace(/[-:.]/g, '');
  const dumpPath = resolve(config.backupDirectory, `qhse-${timestamp}-${services.id()}.dump`);
  const manifestPath = `${dumpPath}.manifest.json`;
  await services.files.ensureDirectory(config.backupDirectory);
  await services.run(
    'pg_dump',
    ['--format=custom', '--file', dumpPath, '--no-owner', '--no-privileges'],
    connection.environment,
  );
  await services.files.secure(dumpPath);
  await services.run('pg_restore', ['--list', dumpPath]);
  const content = await services.files.read(dumpPath);
  const manifest: BackupManifest = {
    version: 1,
    kind: 'qhse-postgresql-backup',
    format: 'postgresql-custom',
    fileName: basename(dumpPath),
    databaseName: connection.databaseName,
    sizeBytes: content.length,
    sha256: checksum(content),
    createdAt,
  };
  await services.files.writeExclusive(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { dumpPath, manifestPath, manifest };
}

export async function verifyDatabaseBackup(
  dumpPath: string,
  manifestPath = `${dumpPath}.manifest.json`,
  overrides: Partial<BackupDependencies> = {},
) {
  const services = dependencies(overrides);
  const [content, manifestContent] = await Promise.all([
    services.files.read(dumpPath),
    services.files.read(manifestPath),
  ]);
  const manifest = parseManifest(manifestContent);
  if (manifest.fileName !== basename(dumpPath))
    throw new Error('backup file name does not match manifest');
  if (manifest.sizeBytes !== content.length) throw new Error('backup size does not match manifest');
  if (manifest.sha256 !== checksum(content))
    throw new Error('backup checksum does not match manifest');
  await services.run('pg_restore', ['--list', dumpPath]);
  return {
    dumpPath: resolve(dumpPath),
    manifestPath: resolve(manifestPath),
    verified: true,
    manifest,
  };
}

async function main() {
  const action = process.argv[2];
  const result =
    action === 'create'
      ? await createDatabaseBackup(databaseBackupConfigFromEnvironment())
      : action === 'verify' && process.env.QHSE_BACKUP_FILE
        ? await verifyDatabaseBackup(process.env.QHSE_BACKUP_FILE, process.env.QHSE_BACKUP_MANIFEST)
        : undefined;
  if (!result) {
    throw new Error(
      action === 'verify'
        ? 'QHSE_BACKUP_FILE is required'
        : 'backup action must be create or verify',
    );
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'database backup failed'}\n`);
    process.exitCode = 1;
  });
}
