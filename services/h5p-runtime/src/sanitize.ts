import sanitizeHtml from "sanitize-html";

/**
 * Sanitizes H5P content parameters before persistence.
 *
 * SPEC-005 remediation (Finding 4): this is a SECOND, independent layer, not
 * a replacement for Lumi's own trusted editor-save sanitization. As of the
 * Finding 3 remediation, imports go through
 * `editor.saveOrUpdateContentReturnMetaData`, which invokes
 * `SemanticsEnforcer.enforceSemanticStructure` — the SAME code path the
 * H5P editor's save action uses, driven by each library's own
 * `semantics.json` (see `SemanticsEnforcer.enforceTextSemantics`, which
 * scopes `sanitize-html` to exactly the tags/styles a field's semantics
 * declare, and unconditionally strips `script`/`style`/`textarea`/`option`
 * everywhere). That enforcer is verified running on imported content in
 * services/h5p-runtime/tests/import.integration.test.ts ("also runs Lumi's
 * OWN trusted editor-save SemanticsEnforcer").
 *
 * This module exists because SemanticsEnforcer only walks fields that are
 * DECLARED in a library's semantics tree. Content parameters may contain:
 *  - free-form/dynamic keys not modeled in semantics.json;
 *  - values from libraries with incomplete or permissive semantics;
 *  - structures the ADR-001 spike identified as historically abused by
 *    legacy WordPress H5P content (arbitrary nested objects/arrays).
 * Recursing through EVERY string in the parameter tree — not just the ones
 * semantics.json happens to describe — is the defense-in-depth this module
 * adds. Prefer Lumi's own enforcer as the primary control; this sanitizer is
 * the narrow backstop for what it cannot see.
 */

const allowedTags = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "sub",
  "sup",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
];

const allowedAttributes: Record<string, string[]> = {
  "*": ["class", "dir", "lang"],
  a: ["href", "target", "rel", "title"],
  img: ["src", "alt", "title", "width", "height"],
  span: ["aria-label"],
};

const allowedSchemes = ["http", "https", "mailto"];

export function sanitizeH5pParameterValue(value: unknown): unknown {
  if (typeof value === "string") {
    // Only run the sanitizer when the string looks like it could contain markup.
    // This preserves plain text and JSON values that are not HTML.
    const hasMarkup = /[<>]/.test(value);
    if (!hasMarkup) return value;
    return sanitizeHtml(value, {
      allowedTags,
      allowedAttributes,
      allowedSchemes,
      disallowedTagsMode: "discard",
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeH5pParameterValue(item));
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = sanitizeH5pParameterValue(item);
    }
    return result;
  }

  return value;
}

export function sanitizeH5pParameters(parameters: unknown): unknown {
  return sanitizeH5pParameterValue(parameters);
}

/**
 * Returns true if the sanitized version of the parameters differs from the
 * original. Useful for security regression tests that verify dangerous markup
 * is actually removed.
 */
export function parametersWereSanitized(original: unknown, sanitized: unknown): boolean {
  return JSON.stringify(original) !== JSON.stringify(sanitized);
}
