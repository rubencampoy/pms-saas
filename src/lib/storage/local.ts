import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StorageProvider, UploadResult } from './types';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor() {
    this.basePath = join(process.cwd(), 'public');
  }

  async upload(file: File, path: string): Promise<UploadResult> {
    const ext = MIME_TO_EXT[file.type] ?? 'jpg';
    const filename = `${randomUUID()}.${ext}`;
    const fullDir = join(this.basePath, path);

    await mkdir(fullDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(join(fullDir, filename), buffer);

    // Normalize to forward slashes for URL (Windows compat)
    const url = `/${path}/${filename}`.replace(/\\/g, '/');
    return { url, filename };
  }

  async delete(url: string): Promise<void> {
    const fullPath = join(this.basePath, url);
    await unlink(fullPath).catch(() => {
      // Ignore if file already deleted
    });
  }

  getPublicUrl(url: string): string {
    return url;
  }
}
