import { LocalStorageProvider } from './local';
import { VercelBlobStorageProvider } from './vercel-blob';
import type { StorageProvider } from './types';

/**
 * Elige el proveedor de almacenamiento.
 *
 * Con BLOB_READ_WRITE_TOKEN definido usa Vercel Blob; es lo que ocurre en
 * producción, donde escribir en public/ no funciona (FS de solo lectura y
 * efímero). Sin el token cae al proveedor local, cómodo para desarrollo.
 */
export function getStorageProvider(): StorageProvider {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return new VercelBlobStorageProvider();
  }
  return new LocalStorageProvider();
}

export type { StorageProvider, UploadResult } from './types';
