"use client";

import { useEffect, useState } from "react";

/**
 * Réglage numérique persisté en localStorage (partagé entre tableau de bord et écrans).
 * SSR-safe : la valeur par défaut est rendue au premier paint, puis synchronisée après montage.
 */
export function useLocalNumber(key: string, initial: number): [number, (n: number) => void, boolean] {
  const [value, setValue] = useState<number>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const n = Number(raw);
        if (Number.isFinite(n) && n > 0) setValue(n);
      }
    } catch {
      // localStorage indisponible : on garde la valeur par défaut
    }
    setReady(true);
  }, [key]);

  const set = (n: number) => {
    setValue(n);
    try {
      window.localStorage.setItem(key, String(n));
    } catch {
      // stockage plein / bloqué : la valeur reste active pour la session
    }
  };

  return [value, set, ready];
}

/** Réglage booléen persisté en localStorage (SSR-safe, comme useLocalNumber). */
export function useLocalBool(key: string, initial: boolean): [boolean, (b: boolean) => void] {
  const [value, setValue] = useState<boolean>(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(raw === "true");
    } catch {
      // localStorage indisponible : on garde la valeur par défaut
    }
  }, [key]);

  const set = (b: boolean) => {
    setValue(b);
    try {
      window.localStorage.setItem(key, b ? "true" : "false");
    } catch {
      // stockage plein / bloqué : la valeur reste active pour la session
    }
  };

  return [value, set];
}

/** Clés des réglages de session. */
export const SETTING_KEYS = {
  cardsSize: "jlpt.cardsSize", // vocabulaire + kanji
  phrasesSize: "jlpt.phrasesSize", // exercices de phrases
  autoAudio: "jlpt.autoAudio", // lecture automatique de la réponse
} as const;
