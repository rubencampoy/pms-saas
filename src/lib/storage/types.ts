export interface UploadResult {
  /** Relative URL path (e.g., /uploads/room-types/abc/def/image.webp) */
  url: string;
  /** Generated filename */
  filename: string;
}

export interface StorageProvider {
  upload(file: File, path: string): Promise<UploadResult>;
  delete(url: string): Promise<void>;
  getPublicUrl(url: string): string;
}
