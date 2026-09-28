import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { sanitizeH5pParameters, parametersWereSanitized } from "../src/sanitize.js";

describe("H5P import parameter sanitizer", () => {
  it("removes script tags from imported parameters", () => {
    const original = {
      question: "What is this?",
      text: "<p>Safe paragraph</p><script>alert('xss')</script>",
    };
    const sanitized = sanitizeH5pParameters(original);
    assert.equal(JSON.stringify(sanitized).includes("<script>"), false);
    assert.equal((sanitized as typeof original).text, "<p>Safe paragraph</p>");
    assert.equal(parametersWereSanitized(original, sanitized), true);
  });

  it("removes javascript: URLs from links", () => {
    const original = {
      intro: "<a href='javascript:alert(1)'>click</a><a href='https://example.com'>ok</a>",
    };
    const sanitized = sanitizeH5pParameters(original);
    assert.equal(JSON.stringify(sanitized).includes("javascript:"), false);
    assert.equal((sanitized as typeof original).intro.includes("https://example.com"), true);
  });

  it("preserves plain text and JSON values", () => {
    const original = {
      title: "Simple title",
      count: 42,
      enabled: true,
      nested: { list: ["one", "two"] },
    };
    const sanitized = sanitizeH5pParameters(original);
    assert.deepEqual(sanitized, original);
    assert.equal(parametersWereSanitized(original, sanitized), false);
  });

  it("sanitizes nested arrays and objects recursively", () => {
    const original = {
      items: [{ text: "<img src=x onerror=alert(1)>" }, { text: "plain" }],
    };
    const sanitized = sanitizeH5pParameters(original);
    assert.equal(JSON.stringify(sanitized).includes("onerror"), false);
    assert.equal((sanitized as typeof original).items[0].text.includes("<img"), true);
    assert.equal((sanitized as typeof original).items[1].text, "plain");
  });
});
