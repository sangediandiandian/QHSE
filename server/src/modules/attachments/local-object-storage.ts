import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { ObjectStorage } from './object-storage';

export class LocalObjectStorage implements ObjectStorage {
  readonly provider = 'local' as const;
  readonly bucket = 'local';
  private readonly root: string;

  constructor(
    root = process.env.QHSE_UPLOAD_DIR || resolve(process.cwd(), '.qhse-data', 'objects'),
  ) {
    this.root = resolve(root);
  }

  async put(key: string, body: Buffer) {
    const path = this.path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body, { flag: 'wx' });
  }

  read(key: string) {
    return readFile(this.path(key));
  }

  private path(key: string) {
    const path = resolve(this.root, key);
    if (path !== this.root && !path.startsWith(`${this.root}${sep}`))
      throw new Error('STORAGE_KEY_INVALID');
    return path;
  }
}
