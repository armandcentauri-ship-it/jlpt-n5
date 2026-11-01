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
  grade: number; // année d'école primaire (KANJIDIC2), 9 = hors programme
  orderIdx: number; // ordre pédagogique (N5 d'abord, puis grade, traits)
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
  theme: string; // clé de thème pédagogique
  orderIdx: number; // ordre pédagogique global
  exJa: string;
  exKana: string;
  exFurigana: string;
  exFr: string;
  exDif: string; // "simple" | "avance"
  exTier: number; // 1 = phrase très facile, 2 = plus riche
}

export interface ProgressItem {
  id: string;
  itemType: "kanji" | "word" | "conj"; // conj = conjugaison (itemId = `${wordId}:${form}`)
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
  stats: {
    attempts: number;
    correct: number;
    attemptsToday: number;
    correctToday: number;
    doneToday: { vocab: boolean; kanji: boolean; phrases: boolean; conj: boolean };
  };
}

export type Grade = 0 | 1 | 2 | 3; // encore | difficile | bien | facile
export type ReviewMode = "flashcard" | "ex_jp_fr" | "ex_fr_jp" | "conj";
