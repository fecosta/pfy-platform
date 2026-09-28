import path from "node:path";
import fs from "node:fs/promises";

import express, { type Request, type Response } from "express";
import { H5PEditor, H5PPlayer, H5PConfig, fsImplementations } from "@lumieducation/h5p-server";
import type { IUser } from "@lumieducation/h5p-server";

import { getRuntimeConfig, runtimeStoragePaths } from "./config.js";
import { verifyRuntimeToken, requireAdminSecret } from "./token.js";
import { sanitizeH5pParameters } from "./sanitize.js";
import { InMemoryStorage } from "./storage.js";

async function main() {
  const config = getRuntimeConfig();
  const storage = runtimeStoragePaths(config.PFY_H5P_STORAGE_PATH);

  await fs.mkdir(storage.content, { recursive: true });
  await fs.mkdir(storage.libraries, { recursive: true });
  await fs.mkdir(storage.temporary, { recursive: true });
  await fs.mkdir(storage.userData, { recursive: true });

  const h5pConfig = await new H5PConfig(new InMemoryStorage(), {
    baseUrl: "/h5p",
    coreUrl: `${config.PFY_H5P_CORE_URL}`,
    librariesUrl: "/h5p/libraries",
    contentFilesUrl: "/h5p/content/:contentId/files",
    playUrl: "/h5p/play",
    ajaxUrl: "/h5p/ajax",
    contentUserDataUrl: "/h5p/content-user-data",
    setFinishedUrl: "/h5p/finished",
    contentWhitelist: config.PFY_H5P_CONTENT_WHITELIST,
    libraryWhitelist: config.PFY_H5P_LIBRARY_WHITELIST,
    platformName: "PFY H5P Runtime",
    platformVersion: "0.1.0",
    siteType: "internet",
    sendUsageStatistics: false,
    fetchingDisabled: 1,
  } as Partial<ConstructorParameters<typeof H5PConfig>[1]>);

  const libraryStorage = new fsImplementations.FileLibraryStorage(storage.libraries);
  const contentStorage = new fsImplementations.FileContentStorage(storage.content);
  const temporaryStorage = new fsImplementations.DirectoryTemporaryFileStorage(storage.temporary);
  const userDataStorage = new fsImplementations.FileContentUserDataStorage(storage.userData);
  const cache = new InMemoryStorage();

  const editor = new H5PEditor(
    cache,
    h5pConfig,
    libraryStorage,
    contentStorage,
    temporaryStorage,
    undefined,
    undefined,
    undefined,
    userDataStorage,
  );

  const player = new H5PPlayer(
    libraryStorage,
    contentStorage,
    h5pConfig,
    undefined,
    undefined,
    undefined,
    undefined,
    userDataStorage,
  );

  const app = express();
  app.use(express.json({ limit: "10mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "pfy-h5p-runtime", version: "0.1.0" });
  });

  app.get("/ready", async (_req, res) => {
    try {
      await fs.access(storage.content);
      await fs.access(storage.libraries);
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "not ready" });
    }
  });

  // PFY-authorized player endpoint.
  app.get("/h5p/play/:contentId", async (req, res) => {
    const token = req.query.token;
    if (typeof token !== "string") {
      res.status(401).json({ error: "missing-token" });
      return;
    }

    const claims = verifyRuntimeToken(token, config.PFY_H5P_RUNTIME_SECRET);
    if (!claims) {
      res.status(401).json({ error: "invalid-token" });
      return;
    }

    const requestedContentId = req.params.contentId;
    if (requestedContentId !== claims.cid) {
      res.status(403).json({ error: "content-mismatch" });
      return;
    }

    const user: IUser = {
      id: claims.sub,
      name: "learner",
      type: "local",
      email: "learner@pfy.local",
    };
    const language = typeof req.query.lang === "string" ? req.query.lang : "pt-BR";

    try {
      const html = await player.render(claims.cid, user, language, {
        ignoreUserPermissions: true,
        showCopyButton: false,
        showDownloadButton: false,
        showEmbedButton: false,
        showFrame: false,
        showH5PIcon: false,
        showLicenseButton: false,
      });
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      res.send(html);
    } catch (error) {
      console.error("Failed to render H5P content", error);
      res.status(404).json({ error: "content-not-found" });
    }
  });

  // Static H5P libraries and content files.
  app.use("/h5p/libraries", express.static(storage.libraries));
  app.use("/h5p/content/:contentId/files", (req, res, next) => {
    const contentId = req.params.contentId;
    const filePath = path.join(storage.content, contentId, "content", req.path);
    express.static(path.dirname(filePath))(req, res, next);
  });
  app.use("/h5p/temp", express.static(storage.temporary));

  // Admin: library installation from an extracted library directory.
  app.post("/h5p/admin/libraries", async (req, res) => {
    if (!requireAdminSecret(req.headers["x-pfy-h5p-admin-secret"] as string | undefined, config)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const directoryPath = req.body.directoryPath;
    if (typeof directoryPath !== "string") {
      res.status(400).json({ error: "missing-directory-path" });
      return;
    }

    try {
      const result = await editor.libraryManager.installFromDirectory(directoryPath, false);
      res.json({ installed: result });
    } catch (error) {
      console.error("Library install failed", error);
      res.status(400).json({ error: "library-install-failed" });
    }
  });

  // Admin: content import from a .h5p package.
  app.post("/h5p/admin/import", async (req, res) => {
    if (!requireAdminSecret(req.headers["x-pfy-h5p-admin-secret"] as string | undefined, config)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const packagePath = req.body.packagePath;
    if (typeof packagePath !== "string") {
      res.status(400).json({ error: "missing-package-path" });
      return;
    }

    try {
      const importResult = await editor.packageImporter.addPackageLibrariesAndContent(packagePath, {
        id: "admin",
        name: "operator",
        type: "local",
        email: "admin@pfy.local",
      });

      // ADR-001 security pipeline: imported parameters must receive equivalent
      // semantic sanitization to the editor-save path before persistence.
      const sanitizedParameters = sanitizeH5pParameters(importResult.parameters);
      await editor.contentManager.createOrUpdateContent(
        importResult.metadata,
        sanitizedParameters as Record<string, unknown>,
        { id: "admin", name: "operator", type: "local", email: "admin@pfy.local" },
        importResult.id,
      );

      res.json({
        contentId: importResult.id,
        title: importResult.metadata.title,
        library: importResult.metadata.mainLibrary,
        sanitized: JSON.stringify(importResult.parameters) !== JSON.stringify(sanitizedParameters),
      });
    } catch (error) {
      console.error("Package import failed", error);
      res.status(400).json({ error: "import-failed" });
    }
  });

  // xAPI / user-data seam endpoints: intentionally no-ops in SPEC-005.
  // SPEC-006 will consume these through the adapter boundary.
  app.post("/h5p/finished", (_req, res) => res.status(204).send());
  app.post("/h5p/content-user-data", (_req, res) => res.status(204).send());
  app.post("/h5p/ajax", (_req, res) => res.status(204).send());

  app.use((err: Error, _req: Request, res: Response) => {
    console.error("Unhandled runtime error", err);
    res.status(500).json({ error: "internal-error" });
  });

  app.listen(config.PORT, () => {
    console.log(`PFY H5P runtime listening on port ${config.PORT}`);
  });
}

main().catch((error) => {
  console.error("Failed to start H5P runtime", error);
  process.exit(1);
});
