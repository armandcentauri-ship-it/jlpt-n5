"use client";

import React, { useEffect, useState } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesReady = false;

function getJaVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  if (voicesReady && cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  const ja = voices.find((v) => v.lang?.toLowerCase().startsWith("ja"));
  if (ja) {
    cachedVoice = ja;
    voicesReady = true;
  }
  return ja;
}

/** Bouton de prononciation japonaise (synthèse vocale du navigateur). */
export function AudioButton({
  text,
  className,
  size = "sm",
}: {
  text: string;
  className?: string;
  size?: "sm" | "icon-lg";
}) {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    // différée : évite un setState synchrone dans l'effet + laisse le temps aux voix de charger
    const t = setTimeout(() => {
      if (cancelled) return;
      if (typeof window === "undefined" || !("speechSynthesis" in window)) setAvailable(false);
      else setAvailable(!!getJaVoice());
    }, 80);
    const check = () => {
      if (!cancelled) setAvailable(!!getJaVoice());
    };
    window.speechSynthesis?.addEventListener?.("voiceschanged", check);
    return () => {
      cancelled = true;
      clearTimeout(t);
      window.speechSynthesis?.removeEventListener?.("voiceschanged", check);
    };
  }, []);

  const speak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = 0.9;
    const v = getJaVoice();
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  };

  if (available === false) return null; // pas de voix japonaise : on masque

  return (
    <Button
      type="button"
      variant="outline"
      size={size === "icon-lg" ? "icon" : "icon"}
      onClick={speak}
      title="Écouter en japonais"
      aria-label={`Écouter : ${text}`}
      className={cn(
        "shrink-0 rounded-full border-border/70 text-ink-soft hover:border-primary hover:text-primary",
        size === "icon-lg" ? "h-11 w-11" : "h-8 w-8",
        className
      )}
    >
      <Volume2 className={size === "icon-lg" ? "h-5 w-5" : "h-4 w-4"} aria-hidden />
    </Button>
  );
}
