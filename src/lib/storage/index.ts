import { LocalStorageProvider } from './local';
import type { StorageProvider } from './types';

export function getStorageProvider(): StorageProvider {
  // Future: check env var STORAGE_PROVIDER=s3 and return S3StorageProvider
  return new LocalStorageProvider();
}

export type { StorageProvider, UploadResult } from './types';
