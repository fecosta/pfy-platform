import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { createApp } from "../src/app.js";
import { getRuntimeConfig } from "../src/config.js";
import { signRuntimeToken } from "../src/token.js";

// SPEC-005 remediation (Finding 1 + Finding 5): HTTP integration coverage for
// the runtime authorization boundary. Boots the real Express app (no mocking
// of the auth middleware) against a random port, seeds one piece of H5P
// content directly through the Lumi editor APIs, and asserts protected routes
// enforce the runtime token — including the specific bypass the review
// flagged: requesting content-file assets directly without going through
// /h5p/play first.
describe("H5P runtime HTTP authorization (Finding 1, Finding 5)", () => {
  const secret = "a-very-long-secret-that-is-at-least-32-characters!";
  const adminSecret = "a-very-long-admin-secret-that-is-at-least-32-chars!";
  let server: Server;
  let baseUrl: string;
  let storageDir: string;
  let contentId: string;
  let temporaryFilePath = "";
  const OTHER_CONTENT_ID = "does-not-exist-and-must-never-be-served";

  before(async () => {
    storageDir = mkdtempSync(path.join(tmpdir(), "pfy-h5p-runtime-test-"));
    const config = getRuntimeConfig({
      PORT: "0",
      PFY_H5P_RUNTIME_SECRET: secret,
      PFY_H5P_ADMIN_SECRET: adminSecret,
      PFY_H5P_STORAGE_PATH: storageDir,
    });
    const { app, editor } = await createApp(config);

    // Seed a minimal runnable library and one piece of content directly
    // through the editor's storage APIs — equivalent to what a real import
    // would produce, without depending on a real .h5p package file here
    // (that path is covered separately in import.integration.test.ts).
    const library = await editor.libraryManager.libraryStorage.addLibrary(
      {
        machineName: "H5P.Test",
        majorVersion: 1,
        minorVersion: 0,
        patchVersion: 0,
        runnable: 1,
        title: "H5P Test",
        preloadedJs: [],
        preloadedCss: [],
      },
      false,
    );
    await editor.libraryManager.libraryStorage.addFile(
      library,
      "semantics.json",
      Readable.from(Buffer.from("[]")),
    );

    const adminUser = { id: "admin", name: "admin", type: "local" as const, email: "a@b.c" };
    // FileContentStorage assigns numeric content ids. The real PFY adapter
    // stores `lumi_content_id` as `text` (supabase/migrations/...exercise_h5p_mapping.sql)
    // and the runtime token payload's `cid` is always a string, so we
    // normalize to string here exactly as the real mapping lookup would.
    const rawContentId = await editor.contentManager.createOrUpdateContent(
      {
        mainLibrary: "H5P.Test",
        preloadedDependencies: [{ machineName: "H5P.Test", majorVersion: 1, minorVersion: 0 }],
        embedTypes: ["iframe"],
        language: "en",
        defaultLanguage: "en",
        license: "U",
        title: "Test content",
      },
      { question: "hello" },
      adminUser,
    );
    contentId = String(rawContentId);
    await editor.contentManager.addContentFile(
      contentId,
      "images/secret.png",
      Readable.from(Buffer.from("not-really-a-png-but-good-enough-for-the-test")),
      adminUser,
    );

    const temporaryUser = {
      id: "uploaded-user",
      name: "uploaded-user",
      type: "local" as const,
      email: "uploaded-user@pfy.local",
    };
    const temporaryFilename = await editor.temporaryFileManager.addFile(
      "uploaded.png",
      Readable.from(Buffer.from("private temporary upload")),
      temporaryUser,
    );
    assert.equal(temporaryFilename.includes("/"), false);
    temporaryFilePath = `uploaded-user/${temporaryFilename}`;

    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    rmSync(storageDir, { recursive: true, force: true });
  });

  function validToken(cid = contentId): string {
    return signRuntimeToken(
      { sub: "learner-1", cid, eid: "exercise-1", act: "activity-1", exp: nowPlus(300) },
      secret,
    );
  }

  function nowPlus(seconds: number): number {
    return Math.floor(Date.now() / 1000) + seconds;
  }

  it("GET /health and /ready respond without auth", async () => {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    const ready = await fetch(`${baseUrl}/ready`);
    assert.equal(ready.status, 200);
  });

  describe("/h5p/play/:contentId", () => {
    it("rejects a request with no token", async () => {
      const res = await fetch(`${baseUrl}/h5p/play/${contentId}`);
      assert.equal(res.status, 401);
    });

    it("rejects a malformed token without throwing", async () => {
      const res = await fetch(`${baseUrl}/h5p/play/${contentId}?token=not-a-token`);
      assert.equal(res.status, 401);
    });

    it("rejects an expired token", async () => {
      const expired = signRuntimeToken(
        { sub: "u", cid: contentId, eid: "e", act: "a", exp: nowPlus(-10) },
        secret,
      );
      const res = await fetch(`${baseUrl}/h5p/play/${contentId}?token=${expired}`);
      assert.equal(res.status, 401);
    });

    it("rejects a tampered token", async () => {
      const token = validToken();
      const tampered = token.slice(0, -4) + "abcd";
      const res = await fetch(`${baseUrl}/h5p/play/${contentId}?token=${tampered}`);
      assert.equal(res.status, 401);
    });

    it("rejects a token whose cid does not match the requested content id", async () => {
      const token = validToken(OTHER_CONTENT_ID);
      const res = await fetch(`${baseUrl}/h5p/play/${contentId}?token=${token}`);
      assert.equal(res.status, 403);
    });

    it("rejects a valid token used against a DIFFERENT content id in the URL", async () => {
      // Token was issued for `contentId`; requesting a different id in the
      // path must fail even though the token signature/expiry are valid.
      const token = validToken(contentId);
      const res = await fetch(`${baseUrl}/h5p/play/${OTHER_CONTENT_ID}?token=${token}`);
      assert.equal(res.status, 403);
    });

    it("renders the player for a valid, matching token", async () => {
      const token = validToken();
      const res = await fetch(`${baseUrl}/h5p/play/${contentId}?token=${token}`);
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.match(html, /H5PIntegration/);
      // The player HTML must embed a REAL token in content-file URLs (the
      // placeholder must never leak to the browser).
      assert.equal(html.includes("__PFY_RUNTIME_TOKEN_PLACEHOLDER__"), false);
      assert.match(html, new RegExp(`/h5p/content/${contentId}/files\\?token=`));
    });

    it("renders playback without relying on a public temporary-file path", async () => {
      const token = validToken();
      const player = await fetch(`${baseUrl}/h5p/play/${contentId}?token=${token}`);
      assert.equal(player.status, 200);

      const temporaryRoute = await fetch(`${baseUrl}/h5p/temp/${temporaryFilePath}`);
      assert.equal(temporaryRoute.status, 404);
    });
  });

  describe("/h5p/content/:contentId/files/* (Finding 1: direct asset access)", () => {
    it("rejects direct access to a protected content file with no token", async () => {
      const res = await fetch(`${baseUrl}/h5p/content/${contentId}/files/images/secret.png`);
      assert.equal(res.status, 401);
    });

    it("rejects direct access with a malformed token", async () => {
      const res = await fetch(
        `${baseUrl}/h5p/content/${contentId}/files/images/secret.png?token=garbage`,
      );
      assert.equal(res.status, 401);
    });

    it("rejects a token issued for a DIFFERENT content id (cannot substitute content id)", async () => {
      const token = validToken(OTHER_CONTENT_ID);
      const res = await fetch(
        `${baseUrl}/h5p/content/${contentId}/files/images/secret.png?token=${token}`,
      );
      assert.equal(res.status, 403);
    });

    it("serves the file when the token matches the requested content id", async () => {
      const token = validToken();
      const res = await fetch(
        `${baseUrl}/h5p/content/${contentId}/files/images/secret.png?token=${token}`,
      );
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("content-type"), "image/png");
      assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.equal(res.headers.get("accept-ranges"), "bytes");
      assert.equal(
        res.headers.get("content-length"),
        String("not-really-a-png-but-good-enough-for-the-test".length),
      );
      const body = await res.text();
      assert.equal(body, "not-really-a-png-but-good-enough-for-the-test");
    });

    it("preserves security and range headers on a partial response", async () => {
      const token = validToken();
      const res = await fetch(
        `${baseUrl}/h5p/content/${contentId}/files/images/secret.png?token=${token}`,
        { headers: { Range: "bytes=0-9" } },
      );
      assert.equal(res.status, 206);
      assert.equal(res.headers.get("content-type"), "image/png");
      assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
      assert.equal(res.headers.get("x-content-type-options"), "nosniff");
      assert.equal(res.headers.get("accept-ranges"), "bytes");
      assert.equal(res.headers.get("content-length"), "10");
      assert.equal(
        res.headers.get("content-range"),
        `bytes 0-9/${"not-really-a-png-but-good-enough-for-the-test".length}`,
      );
      assert.equal(await res.text(), "not-really");
    });

    it("does not expose uploaded temporary files through the former static route", async () => {
      const res = await fetch(`${baseUrl}/h5p/temp/${temporaryFilePath}`);
      assert.equal(res.status, 404);
      assert.equal((await res.text()).includes("private temporary upload"), false);
    });

    it("cannot be bypassed by path traversal in the filename segment", async () => {
      const token = validToken();
      const res = await fetch(
        `${baseUrl}/h5p/content/${contentId}/files/../../../etc/passwd?token=${token}`,
      );
      assert.notEqual(res.status, 200);
    });
  });

  describe("/h5p/libraries (public H5P runtime code, not protected content)", () => {
    it("does not require a token", async () => {
      // Library dir won't have this exact file, but the route itself must not
      // 401 — it should fall through to a plain 404 from express.static.
      const res = await fetch(`${baseUrl}/h5p/libraries/H5P.Test-1.0/semantics.json`);
      assert.equal(res.status, 200);
    });
  });

  describe("admin endpoints (constant-time secret, negative cases)", () => {
    it("rejects with no admin secret", async () => {
      const res = await fetch(`${baseUrl}/h5p/admin/libraries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directoryPath: "/tmp/nope" }),
      });
      assert.equal(res.status, 403);
    });

    it("rejects an incorrect admin secret", async () => {
      const res = await fetch(`${baseUrl}/h5p/admin/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PFY-H5P-Admin-Secret": "wrong-secret-wrong-secret-wrong-secret!",
        },
        body: JSON.stringify({ packagePath: "/tmp/nope.h5p" }),
      });
      assert.equal(res.status, 403);
    });

    it("rejects GET on an admin route (only POST is supported)", async () => {
      const res = await fetch(`${baseUrl}/h5p/admin/import`, { method: "GET" });
      assert.equal(res.status, 404);
    });
  });
});
