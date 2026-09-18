import rawCopyLibrary from "../data/copy-library.json";

export type CopyLanguage = "zh" | "en";

export interface CopyLibraryItem {
  id: string;
  original: string;
  translationZh?: string;
  language: CopyLanguage;
  author?: string;
  work: string;
  sourceName: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  translationNote: string;
  tags: string[];
}

export const copyLibrary = rawCopyLibrary as CopyLibraryItem[];
export const copyLibrarySize = copyLibrary.length;

function hash(value: string) {
  let result = 2_166_136_261;
  for (const character of value) {
    result = Math.imul(result ^ character.codePointAt(0)!, 16_777_619);
  }
  return result >>> 0;
}

function getDateDayNumber(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return 0;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return 0;
  }

  return Math.floor(date.getTime() / 86_400_000);
}

// Shuffle once with a stable key so consecutive days feel random while every
// entry is visited exactly once before the 1000-day cycle repeats.
const dailyOrder = copyLibrary
  .slice()
  .sort((left, right) => hash(`focused-moment:${left.id}`) - hash(`focused-moment:${right.id}`) || left.id.localeCompare(right.id));

export function getDailyCopy(dateKey: string): CopyLibraryItem {
  const dayNumber = getDateDayNumber(dateKey);
  const index = ((dayNumber % dailyOrder.length) + dailyOrder.length) % dailyOrder.length;
  return dailyOrder[index];
}

export function getCopyDisplayText(copy: CopyLibraryItem) {
  return copy.language === "en" ? copy.translationZh ?? copy.original : copy.original;
}

export function getCopyOriginalText(copy: CopyLibraryItem) {
  return copy.language === "en" ? copy.original : "";
}

export function getCopyAttribution(copy: CopyLibraryItem) {
  return copy.author ? `${copy.author} · ${copy.work}` : copy.work;
}
