export interface KanjiExample {
  word: string;
  reading: string;
  fr: string;
  en?: string;
}

export interface KanjiItem {
  id: string;
  character: string;
  level: string; // "N5" | "N4"
  onyomi: string; // "、"-separated
  kunyomi: string;
  strokes: number;
  meaningsFr: string[];
  meaningsEn: string[];
  examples: KanjiExample[];
}

export interface WordItem {
  id: string;
  wid: number;
  word: string;
  reading: string;
  romaji: string;
  level: string; // "N5" | "N4"
  pos: string[];
  meaningFr: string;
  meaningEn: string;
  exJa: string;
  exKana: string;
  exFurigana: string;
  exFr: string;
  exDif: string; // "simple" | "avance"
}

export interface ProgressItem {
  id: string;
  itemType: "kanji" | "word";
  itemId: string;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: string; // ISO
  lastReviewedAt: string | null;
}

export interface ContentResponse {
  words: WordItem[];
  kanji: KanjiItem[];
  progress: ProgressItem[];
  stats: { attempts: number; correct: number; attemptsToday: number; correctToday: number };
}

export type Grade = 0 | 1 | 2 | 3; // encore | difficile | bien | facile
export type ReviewMode = "flashcard" | "ex_jp_fr" | "ex_fr_jp";
