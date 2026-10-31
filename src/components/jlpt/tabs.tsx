export type TabId = "dashboard" | "flashcards" | "exercises" | "conjugation" | "kanji" | "vocab";

export const TABS: { id: TabId; label: string; jp: string }[] = [
  { id: "dashboard", label: "Tableau de bord", jp: "家" },
  { id: "flashcards", label: "Flashcards", jp: "暗記" },
  { id: "exercises", label: "Exercices", jp: "翻訳" },
  { id: "conjugation", label: "Conjugaison", jp: "動詞" },
  { id: "kanji", label: "Kanji", jp: "漢字" },
  { id: "vocab", label: "Vocabulaire", jp: "単語" },
];
