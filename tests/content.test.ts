import { describe, expect, it } from "vitest";

import { parseActivityBlock } from "@/lib/content/types";

describe("content read model", () => {
  it("keeps approved block semantics explicit without imposing a sequence", () => {
    expect(
      parseActivityBlock({
        id: "block-heading",
        position: 4,
        block_type: "heading",
        content: { text: "Bora entender?" },
        exercise_id: null,
      }),
    ).toEqual({ id: "block-heading", position: 4, type: "heading", text: "Bora entender?" });
  });

  it("drops unsupported or malformed blocks instead of rendering arbitrary JSON", () => {
    expect(
      parseActivityBlock({
        id: "block-unknown",
        position: 1,
        block_type: "unknown",
        content: { html: "<script>bad()</script>" },
        exercise_id: null,
      }),
    ).toBeNull();
    expect(
      parseActivityBlock({
        id: "block-image",
        position: 2,
        block_type: "image",
        content: { src: "javascript:alert(1)", alt: "unsafe" },
        exercise_id: null,
      }),
    ).toBeNull();
  });

  it("requires an Exercise block to carry its canonical Exercise identity", () => {
    expect(
      parseActivityBlock({
        id: "block-exercise",
        position: 1,
        block_type: "exercise",
        content: {},
        exercise_id: null,
      }),
    ).toBeNull();
    expect(
      parseActivityBlock({
        id: "block-exercise",
        position: 1,
        block_type: "exercise",
        content: {},
        exercise_id: "exercise-uuid",
      }),
    ).toEqual({ id: "block-exercise", position: 1, type: "exercise", exerciseId: "exercise-uuid" });
  });
});
