import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeLanguageLevel } from "./languageLevels.ts";

describe("language level normalization", () => {
  it("keeps the wizard's stable CEFR values and native-language sentinel", () => {
    assert.equal(normalizeLanguageLevel("B2"), "B2");
    assert.equal(normalizeLanguageLevel("C1"), "C1");
    assert.equal(normalizeLanguageLevel("Muttersprache"), "Muttersprache");
  });

  it("keeps legacy editor values selected instead of rendering them blank", () => {
    assert.equal(normalizeLanguageLevel("C2 – Verhandlungssicher"), "C2");
    assert.equal(normalizeLanguageLevel("C1 – Sehr gut"), "C1");
    assert.equal(normalizeLanguageLevel("B2 – Gut"), "B2");
    assert.equal(normalizeLanguageLevel("Bardzo dobry (C1)"), "C1");
  });
});