/** Interface only: no upload success is returned without a real provider. */
export interface StorageFile {
  path: string;
  mediaType: string;
  bytes: Uint8Array;
}
export interface StoredDirectory {
  uri: `ipfs://${string}`;
  files: ReadonlyArray<{ path: string; uri: `ipfs://${string}` }>;
}
export interface StorageProvider {
  uploadDirectory(files: ReadonlyArray<StorageFile>, signal?: AbortSignal): Promise<StoredDirectory>;
  verifyAvailability(uri: `ipfs://${string}`, signal?: AbortSignal): Promise<{ available: boolean; pinned: boolean }>;
}
