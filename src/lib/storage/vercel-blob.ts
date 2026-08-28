import { put, del } from '@vercel/blob';
import { randomUUID } from 'node:crypto';
import type { StorageProvider, UploadResult } from './types';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
};

/**
 * Almacenamiento en Vercel Blob.
 *
 * Es el proveedor que hay que usar en producción: el sistema de ficheros de
 * Vercel es de solo lectura fuera de /tmp y no persiste entre invocaciones, así
 * que `LocalStorageProvider` (que escribe en public/) solo sirve en desarrollo.
 *
 * Devuelve URLs absolutas al CDN de Blob, no rutas relativas.
 */
export class VercelBlobStorageProvider implements StorageProvider {
  async upload(file: File, path: string): Promise<UploadResult> {
    const ext = MIME_TO_EXT[file.type] ?? 'jpg';
    const filename = `${randomUUID()}.${ext}`;

    const blob = await put(`${path}/${filename}`, file, {
      access: 'public',
      contentType: file.type,
      // El nombre ya lleva un UUID; sin esto Blob añadiría un sufijo aleatorio
      // extra y la URL dejaría de ser predecible a partir del filename.
      addRandomSuffix: false,
    });

    return { url: blob.url, filename };
  }

  async delete(url: string): Promise<void> {
    // Borrar algo que ya no existe no es un error para el llamante.
    await del(url).catch(() => {});
  }

  getPublicUrl(url: string): string {
    return url;
  }
}
