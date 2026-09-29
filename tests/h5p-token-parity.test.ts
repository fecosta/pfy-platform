import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// SPEC-005 remediation (Finding 2): the PFY app and the isolated H5P runtime
// each ship their own copy of the token verification logic because they are
// separate deployables without a shared workspace package. A prior review
// found this created a real risk of the two implementations silently
// diverging (e.g. one gets a security fix, the other doesn't). This test
// extracts the shared verification/signing region from both files and fails
// if they diverge, so any future edit to one side must be mirrored in the
// other before it can merge.
describe("H5P runtime token implementation parity (Finding 2)", () => {
  it("keeps src/lib/h5p/token.ts and services/h5p-runtime/src/token.ts in sync", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const appSource = readFileSync(path.join(root, "src/lib/h5p/token.ts"), "utf-8");
    const runtimeSource = readFileSync(
      path.join(root, "services/h5p-runtime/src/token.ts"),
      "utf-8",
    );

    const extractSharedRegion = (source: string): string => {
      const start = source.indexOf("export interface RuntimeTokenPayload");
      const end = source.indexOf("export function verifyRuntimeToken");
      const endOfVerify = source.indexOf(
        "\n}\n",
        source.indexOf("export function verifyRuntimeToken"),
      );
      if (start === -1 || end === -1 || endOfVerify === -1) {
        throw new Error("Could not locate shared token region for parity check");
      }
      return source.slice(start, endOfVerify);
    };

    expect(extractSharedRegion(runtimeSource)).toBe(extractSharedRegion(appSource));
  });
});
