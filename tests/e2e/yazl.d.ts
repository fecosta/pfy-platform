// yazl ships no TypeScript types and no @types/yazl package exists on npm.
// Minimal ambient declaration covering only what the H5P playback E2E fixture
// builder uses. Mirrors services/h5p-runtime/tests/yazl.d.ts.
declare module "yazl" {
  import type { PassThrough } from "node:stream";

  export class ZipFile {
    outputStream: PassThrough;
    addBuffer(buffer: Buffer, metadataPath: string): void;
    end(): void;
  }
}
