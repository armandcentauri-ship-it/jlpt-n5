"use client";

import React from "react";
import { cn } from "@/lib/utils";

/** Badge de niveau JLPT. */
export function LevelBadge({ level, className }: { level: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        level === "N4"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-gold/40 bg-gold/15 text-[#8a6d1d]",
        className
      )}
    >
      {level}
    </span>
  );
}

/** Anneau de progression SVG. */
export function ProgressRing({
  value,
  size = 84,
  stroke = 9,
  color = "var(--primary)",
  trackColor = "var(--border)",
  children,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Carte de statistique du tableau de bord. */
export function StatCard({
  title,
  main,
  sub,
  children,
  className,
}: {
  title: string;
  main?: string;
  sub?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-sm", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {main !== undefined && <p className="mt-1 font-jp text-2xl font-semibold">{main}</p>}
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      {children}
    </div>
  );
}

/** Puce de filtre cliquable. */
export function FilterChip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Titre de section avec trait de pinceau. */
export function SectionTitle({ kanji, children }: { kanji: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-jp text-xl text-primary" aria-hidden>
        {kanji}
      </span>
      <h2 className="text-lg font-semibold">{children}</h2>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}
