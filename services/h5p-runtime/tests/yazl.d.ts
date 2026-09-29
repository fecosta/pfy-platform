// yazl ships no TypeScript types and no @types/yazl package exists on npm.
// Minimal ambient declaration covering only what the import-security
// integration test fixture builder uses.
declare module "yazl" {
  import type { PassThrough } from "node:stream";

  export class ZipFile {
    outputStream: PassThrough;
    addBuffer(buffer: Buffer, metadataPath: string): void;
    end(): void;
  }
}
