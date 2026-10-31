"use client";

import React, { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toKana } from "@/lib/romaji";
import { cn } from "@/lib/utils";

/**
 * Champ de saisie japonais : convertit le romaji en kana à la volée (mode あ),
 * ou laisse le texte brut (mode Aa, pour coller du kanji ou taper du français).
 */
export function KanaInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  autoFocus,
  disabled,
  kanaMode: kanaModeProp = true,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  kanaMode?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const [kanaMode, setKanaMode] = useState(kanaModeProp);
  const composing = useRef(false);

  const handleChange = (raw: string) => {
    onChange(kanaMode ? toKana(raw) : raw);
  };

  return (
    <div className={cn("relative flex-1", className)}>
      <Input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) {
            composing.current = true;
            return;
          }
          if (e.key === "Enter" && onSubmit && !composing.current) {
            e.preventDefault();
            onSubmit();
          }
        }}
        onBlur={() => (composing.current = false)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={ariaLabel}
        lang="ja"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="font-jp h-12 pr-20 text-lg md:h-14 md:text-xl"
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => {
          if (kanaMode) {
            setKanaMode(false);
          } else {
            setKanaMode(true);
            handleChange(value); // reconvertit ce qui est déjà tapé
          }
        }}
        title={kanaMode ? "Mode kana (romaji→kana) activé — cliquer pour taper librement" : "Mode libre — cliquer pour activer le clavier kana"}
        aria-label={kanaMode ? "Désactiver le clavier kana" : "Activer le clavier kana"}
        className={cn(
          "absolute right-1.5 top-1/2 h-8 min-w-10 -translate-y-1/2 rounded-md font-jp text-sm font-semibold",
          kanaMode ? "bg-primary/10 text-primary" : "text-muted-foreground"
        )}
      >
        {kanaMode ? "あ" : "Aa"}
      </Button>
    </div>
  );
}

/** Convertit du romaji pour l'aperçu (utilisé par les hints). */
export function useRomajiPreview(text: string) {
  return useMemo(() => toKana(text), [text]);
}
