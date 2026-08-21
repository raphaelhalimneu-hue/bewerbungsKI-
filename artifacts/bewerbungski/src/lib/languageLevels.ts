export const LANGUAGE_LEVEL_VALUES = ["A1", "A2", "B1", "B2", "C1", "C2", "Muttersprache"] as const;

export type LanguageLevelValue = (typeof LANGUAGE_LEVEL_VALUES)[number];

const CEFR_LEVEL = /\b(A1|A2|B1|B2|C1|C2)\b/;

/**
 * Keeps language levels from older editor documents selectable without
 * rewriting them until the user deliberately changes the value.
 */
export function normalizeLanguageLevel(level: string): string {
  if (level === "Muttersprache") return level;
  return level.match(CEFR_LEVEL)?.[1] ?? level;
}

export function languageLevelLabelKey(level: LanguageLevelValue): string {
  if (level === "Muttersprache") return "editor.levelNative";
  return `editor.level${level}`;
}