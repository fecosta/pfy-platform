import fs from "node:fs/promises";

import express, { type NextFunction, type Request, type Response } from "express";
import {
  H5PEditor,
  H5PPlayer,
  H5PAjaxEndpoint,
  H5PConfig,
  fsImplementations,
} from "@lumieducation/h5p-server";
import type { IUser } from "@lumieducation/h5p-server";

import type { RuntimeConfig } from "./config.js";
import { runtimeStoragePaths } from "./config.js";
import { verifyRuntimeToken, requireAdminSecret } from "./token.js";
import { sanitizeH5pParameters } from "./sanitize.js";
import { InMemoryStorage } from "./storage.js";

// SPEC-005 remediation (Finding 1): placeholder substituted with the
// already-verified runtime token when the player HTML is rendered. See the
// contentFilesUrlPlayerOverride comment below for why this is necessary.
const CONTENT_TOKEN_PLACEHOLDER = "__PFY_RUNTIME_TOKEN_PLACEHOLDER__";
const CONTENT_FILE_SECURITY_HEADERS = {
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
};

/**
 * Builds the H5P runtime Express app plus the Lumi editor/player instances
 * backing it. Split out from index.ts so integration tests can exercise the
 * full HTTP surface (including authorization) without binding a real port,
 * and can seed content directly through `editor` for fixtures.
 */
export async function createApp(config: RuntimeConfig) {
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

  // SPEC-005 remediation (Finding 1): H5PConfig's constructor only applies a
  // `defaults` field when the target property is already non-undefined on
  // the class (guard against typos) — `contentFilesUrlPlayerOverride` starts
  // undefined, so passing it through the constructor above is silently
  // dropped. Verified directly: without this line the rendered player HTML
  // falls back to a bare, unauthenticated content-file path. Set it directly
  // on the instance instead.
  //
  // window.H5PIntegration.contents["cid-<id>"].contentUrl is what the
  // player's JS client actually uses to fetch content files/media in the
  // browser. h5p-server only substitutes "{{contentId}}" in this template
  // (see UrlGenerator.contentFilesUrl); it has no per-request hook for
  // additional query parameters. We inject a stable placeholder here and
  // substitute the caller's already-verified runtime token into the
  // rendered HTML in the /h5p/play handler below, so every content-file
  // request the player issues carries proof of authorization for this exact
  // content id.
  h5pConfig.contentFilesUrlPlayerOverride = `/h5p/content/{{contentId}}/files?token=${CONTENT_TOKEN_PLACEHOLDER}`;

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

  // Used only to serve content files with the SAME permission-checked code
  // path h5p-server itself defines (H5PAjaxEndpoint.getContentFile), instead
  // of a bespoke static file handler with no authorization at all.
  const ajaxEndpoint = new H5PAjaxEndpoint(editor);

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

  /**
   * Verifies the runtime token for a request and checks that it authorizes
   * the requested Lumi content id. Returns the verified claims/user on
   * success, or null after already writing a 401/403 response.
   *
   * SPEC-005 remediation (Finding 1): this same check gates BOTH the player
   * HTML route and the content-file/asset route below. Playback authorization
   * must not be enforceable at only one of the two places a browser can
   * request protected content.
   */
  function authorizeContentRequest(
    req: Request,
    res: Response,
    contentId: string,
  ): { user: IUser; cid: string } | null {
    const token = req.query.token;
    if (typeof token !== "string") {
      res.status(401).json({ error: "missing-token" });
      return null;
    }

    const claims = verifyRuntimeToken(token, config.PFY_H5P_RUNTIME_SECRET);
    if (!claims) {
      res.status(401).json({ error: "invalid-token" });
      return null;
    }

    if (contentId !== claims.cid) {
      res.status(403).json({ error: "content-mismatch" });
      return null;
    }

    return {
      cid: claims.cid,
      user: { id: claims.sub, name: "learner", type: "local", email: "learner@pfy.local" },
    };
  }

  // PFY-authorized player endpoint.
  app.get("/h5p/play/:contentId", async (req, res) => {
    const authorized = authorizeContentRequest(req, res, req.params.contentId);
    if (!authorized) return;

    const token = req.query.token as string;
    const language = typeof req.query.lang === "string" ? req.query.lang : "pt-BR";

    try {
      const html = await player.render(authorized.cid, authorized.user, language, {
        ignoreUserPermissions: true,
        showCopyButton: false,
        showDownloadButton: false,
        showEmbedButton: false,
        showFrame: false,
        showH5PIcon: false,
        showLicenseButton: false,
      });
      // SPEC-005 remediation (Finding 1): substitute the caller's
      // already-verified token into the content-file URLs embedded in the
      // player integration object (see contentFilesUrlPlayerOverride above),
      // so the player's own asset requests carry authorization too.
      const authorizedHtml = html.split(CONTENT_TOKEN_PLACEHOLDER).join(encodeURIComponent(token));
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
      res.send(authorizedHtml);
    } catch (error) {
      console.error("Failed to render H5P content", error);
      res.status(404).json({ error: "content-not-found" });
    }
  });

  // SPEC-005 remediation (Finding 1): PFY-protected content files/media.
  // Requires the same runtime token as /h5p/play/:contentId, verified against
  // the SAME content id being requested — a token issued for content A can
  // never be replayed to read files for content B. Delegates the actual file
  // read to h5p-server's own permission-checked getContentFile so behavior
  // (range requests, 404 mapping, mimetype detection) matches upstream.
  app.get("/h5p/content/:contentId/files/*", async (req, res) => {
    const authorized = authorizeContentRequest(req, res, req.params.contentId);
    if (!authorized) return;

    // req.params[0] is everything matched by the wildcard, i.e. the file path
    // relative to the content's file root. h5p-server's own storage layer
    // (FileContentStorage -> checkFilename) rejects "../" traversal and
    // absolute paths in this filename before touching the filesystem.
    const filename = (req.params as unknown as { 0: string })[0];
    if (!filename) {
      res.status(400).json({ error: "missing-filename" });
      return;
    }

    try {
      const { mimetype, stream, stats, range } = await ajaxEndpoint.getContentFile(
        authorized.cid,
        filename,
        authorized.user,
        (fileSize) => {
          const parsed = req.range(fileSize);
          if (!parsed || parsed === -1 || parsed === -2 || parsed.length === 0) return undefined;
          return parsed[0];
        },
      );
      if (range) {
        res.writeHead(206, {
          ...CONTENT_FILE_SECURITY_HEADERS,
          "Content-Type": mimetype,
          "Content-Length": range.end - range.start + 1,
          "Content-Range": `bytes ${range.start}-${range.end}/${stats.size}`,
          "Accept-Ranges": "bytes",
        });
      } else {
        res.writeHead(200, {
          ...CONTENT_FILE_SECURITY_HEADERS,
          "Content-Type": mimetype,
          "Content-Length": stats.size,
          "Accept-Ranges": "bytes",
        });
      }
      stream.on("error", () => res.status(404).end());
      res.on("close", () => stream.destroy());
      stream.pipe(res);
    } catch (error) {
      console.error("Failed to read content file", error);
      res.status(404).json({ error: "content-file-not-found" });
    }
  });

  // Public: H5P core/library JavaScript and CSS. This is not PFY-protected
  // learning content — it is the same H5P runtime/library code shipped to
  // every player regardless of which content is being viewed, so it carries
  // no confidential or per-learner information and requires no token.
  app.use("/h5p/libraries", express.static(storage.libraries));

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
  //
  // SPEC-005 remediation (Finding 3): `addPackageLibrariesAndContent` was
  // VERIFIED (see services/h5p-runtime/README.md "Import pipeline" section
  // and the implementation report) to call
  // ContentStorer.copyFromDirectoryToStorage, which already invokes
  // `contentManager.createOrUpdateContent(metadata, UNSANITIZED parameters,
  // ...)` and persists content files to permanent storage BEFORE this route
  // handler regains control. The previous implementation's follow-up
  // `createOrUpdateContent` call with sanitized parameters was a SECOND write
  // that overwrote the first — meaning unsanitized attacker-controlled
  // parameters were briefly the durable, readable state, and any failure
  // between the two calls (crash, timeout) would leave the unsanitized
  // version persisted permanently.
  //
  // Fix: do the package -> filesystem extraction and library installation
  // through `addPackageLibrariesAndTemporaryFiles` (Lumi's OWN "upload,
  // don't yet persist" path, also used by its editor upload flow), sanitize
  // the returned parameters, and only THEN call `createOrUpdateContent` once
  // to persist. This ensures sanitized content is the only version ever
  // written to permanent content storage.
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

    const adminUser: IUser = {
      id: "admin",
      name: "operator",
      type: "local",
      email: "admin@pfy.local",
    };

    try {
      // Extracts the package (with h5p-server's own archive/path-traversal
      // and file-extension validation), installs required libraries, and
      // copies content files into TEMPORARY storage only. No content.json is
      // written to permanent content storage by this call.
      const uploadResult = await editor.uploadPackage(packagePath, adminUser);
      if (!uploadResult.metadata || !uploadResult.parameters) {
        res.status(400).json({ error: "import-failed", reason: "missing-metadata-or-parameters" });
        return;
      }

      // ADR-001 security pipeline: imported parameters must receive
      // equivalent semantic sanitization to the editor-save path BEFORE
      // permanent persistence.
      const sanitizedParameters = sanitizeH5pParameters(uploadResult.parameters);
      const mainLibraryUbername = uploadResult.metadata.preloadedDependencies?.find(
        (dependency) => dependency.machineName === uploadResult.metadata!.mainLibrary,
      );
      if (!mainLibraryUbername) {
        res.status(400).json({ error: "import-failed", reason: "unresolved-main-library" });
        return;
      }
      const ubername = `${mainLibraryUbername.machineName} ${mainLibraryUbername.majorVersion}.${mainLibraryUbername.minorVersion}`;

      // First (and only) permanent persistence of this content: sanitized
      // parameters, going through H5PEditor's normal save path (which also
      // copies referenced files out of temporary storage). `contentId` is
      // typed as required in h5p-server's declarations, but the runtime
      // implementation (and its own editor-upload flow) accepts `undefined`
      // to mean "assign a new content id" — verified in ContentStorer and
      // FileContentStorage.createContentId.
      const { id: contentId, metadata } = await editor.saveOrUpdateContentReturnMetaData(
        undefined as unknown as string,
        sanitizedParameters,
        uploadResult.metadata,
        ubername,
        adminUser,
      );

      res.json({
        contentId,
        title: metadata.title,
        library: metadata.mainLibrary,
        sanitized: JSON.stringify(uploadResult.parameters) !== JSON.stringify(sanitizedParameters),
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

  // Express 4 only treats a middleware as an error handler if it declares
  // exactly 4 parameters. The prior 3-parameter version was silently never
  // invoked as an error handler (Express instead fell through to its default
  // handler, which can leak stack traces). `_next` must stay declared and
  // unused for Express to recognize this signature.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Unhandled runtime error", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "internal-error" });
  });

  return { app, editor, player };
}
