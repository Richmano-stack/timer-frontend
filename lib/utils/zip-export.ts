import { strToU8, zipSync } from 'fflate';

export interface ZipFileEntry {
  name: string;
  content: string;
}

export function buildZipBuffer(files: ZipFileEntry[]): Buffer {
  const zipData: Record<string, Uint8Array> = {};
  for (const file of files) {
    zipData[file.name] = strToU8(file.content);
  }
  return Buffer.from(zipSync(zipData));
}
