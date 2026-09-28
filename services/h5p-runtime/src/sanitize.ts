import sanitizeHtml from "sanitize-html";

/**
 * Sanitizes H5P content parameters before persistence.
 *
 * Lumi 10.0.x package import does not apply the same parameter sanitization
 * as the editor-save path. This sanitizer is the mandatory ADR-001 security
 * pipeline step that removes dangerous markup from imported content parameters.
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
