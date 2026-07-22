import { z } from "zod";

export const translationLanguageSchema = z.enum(["zh-CN", "en"]);

export type TranslationLanguage = z.infer<typeof translationLanguageSchema>;

export const DEFAULT_TRANSLATION_LANGUAGE: TranslationLanguage = "zh-CN";

export const translationLanguageOptions: ReadonlyArray<{
  label: string;
  value: TranslationLanguage;
}> = [
  { label: "Simplified Chinese", value: "zh-CN" },
  { label: "English", value: "en" },
];

export const translationLanguageLabels: Record<
  TranslationLanguage,
  string
> = {
  "zh-CN": "Simplified Chinese",
  en: "English",
};

const HAN_CHARACTER_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
const JAPANESE_CHARACTER_PATTERN = /[\u3040-\u30ff]/u;
const TRADITIONAL_CHINESE_CHARACTER_PATTERN =
  /[們來這個為與會說時間問題應該經過還點開關後裡發現實業務團隊討論]/u;
const LATIN_WORD_PATTERN = /[A-Za-z][A-Za-z']*/g;
const ENGLISH_INDICATOR_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "be",
  "for",
  "from",
  "has",
  "have",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "our",
  "that",
  "the",
  "this",
  "to",
  "was",
  "we",
  "will",
  "with",
  "you",
]);
const MIN_CHINESE_CHARACTERS = 12;
const MIN_ENGLISH_WORDS = 5;
const CHINESE_SCORE_THRESHOLD = 0.35;
const ENGLISH_SCORE_THRESHOLD = 0.65;

export function normalizeTranslationLanguage(
  value: unknown,
): TranslationLanguage {
  return translationLanguageSchema.catch(DEFAULT_TRANSLATION_LANGUAGE).parse(value);
}

export function shouldAutoTranslateTranscript(
  text: string,
  targetLanguage: TranslationLanguage = DEFAULT_TRANSLATION_LANGUAGE,
) {
  return targetLanguage === "zh-CN"
    ? !isMostlyChineseTranscript(text)
    : !isMostlyEnglishTranscript(text);
}

function isMostlyChineseTranscript(text: string) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return false;
  }

  if (
    JAPANESE_CHARACTER_PATTERN.test(trimmedText) ||
    TRADITIONAL_CHINESE_CHARACTER_PATTERN.test(trimmedText)
  ) {
    return false;
  }

  const chineseCharacterCount = Array.from(trimmedText).filter((character) =>
    HAN_CHARACTER_PATTERN.test(character),
  ).length;

  if (chineseCharacterCount < MIN_CHINESE_CHARACTERS) {
    return false;
  }

  const latinWordCount = trimmedText.match(LATIN_WORD_PATTERN)?.length ?? 0;
  const chineseScore =
    chineseCharacterCount / (chineseCharacterCount + latinWordCount * 2);

  return chineseScore >= CHINESE_SCORE_THRESHOLD;
}

function isMostlyEnglishTranscript(text: string) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return false;
  }

  const latinWords = trimmedText.match(LATIN_WORD_PATTERN) ?? [];
  const latinWordCount = latinWords.length;

  if (latinWordCount < MIN_ENGLISH_WORDS) {
    return false;
  }

  const englishIndicatorCount = latinWords.filter((word) =>
    ENGLISH_INDICATOR_WORDS.has(word.toLowerCase()),
  ).length;

  if (englishIndicatorCount < 2) {
    return false;
  }

  const chineseCharacterCount = Array.from(trimmedText).filter((character) =>
    HAN_CHARACTER_PATTERN.test(character),
  ).length;
  const englishScore =
    (latinWordCount * 2) / (latinWordCount * 2 + chineseCharacterCount);

  return englishScore >= ENGLISH_SCORE_THRESHOLD;
}
