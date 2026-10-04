import path from 'node:path';
import fs from 'node:fs';

let cachedStorageDir: string | null = null;

export function storageDir(): string {
  if (cachedStorageDir) {
    if (!fs.existsSync(cachedStorageDir)) {
      fs.mkdirSync(cachedStorageDir, { recursive: true });
    }
    return cachedStorageDir;
  }

  const configured = process.env.STORAGE_DIR;
  const resolved = configured
    ? (path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured))
    : path.resolve(process.cwd(), 'storage', 'uploads');

  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }

  cachedStorageDir = resolved;
  return resolved;
}
