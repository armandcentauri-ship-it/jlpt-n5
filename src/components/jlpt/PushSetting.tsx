"use client";

import React, { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type State = "loading" | "on" | "off" | "blocked" | "unsupported" | "nokeys";

/** Convertit la clé publique VAPID (base64url) en Uint8Array pour pushManager. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Ligne de réglage « Notifications quotidiennes » (push web, cet appareil). */
export function PushSetting() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  /* état réel au montage : la source de vérité est l'abonnement push du navigateur */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
          if (!cancelled) setState("unsupported");
          return;
        }
        const cfg = (await fetch("/api/push/config").then((r) => r.json())) as { publicKey: string | null };
        if (!cfg.publicKey) {
          if (!cancelled) setState("nokeys");
          return;
        }
        const sub = await getSubscription();
        if (cancelled) return;
        if (sub) setState("on");
        else if (Notification.permission === "denied") setState("blocked");
        else setState("off");
      } catch {
        if (!cancelled) setState("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("blocked");
        return;
      }
      const cfg = (await fetch("/api/push/config").then((r) => r.json())) as { publicKey: string | null };
      if (!cfg.publicKey) {
        toast({ title: "Notifications indisponibles", description: "Le serveur n'a pas de clés configurées.", variant: "destructive" });
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setState("on");
      toast({
        title: "Notifications activées 🌸",
        description: "Tu recevras un rappel chaque soir s'il reste des cartes à revoir.",
      });
    } catch {
      toast({ title: "Impossible d'activer", description: "Vérifie ta connexion puis réessaie.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const sub = await getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      /* on ignore : le navigateur est déjà propre */
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const sub = await getSubscription();
      if (!sub) return;
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      if (res.ok) {
        toast({ title: "Notification de test envoyée !", description: "Regarde tes notifications système." });
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast({ title: "Échec de l'envoi", description: err.error ?? "Réessaie dans un instant.", variant: "destructive" });
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="py-2 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-border/60">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 sm:flex-nowrap">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="font-jp w-8 shrink-0 text-sm font-semibold text-muted-foreground" aria-hidden>
            報
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">Notifications quotidiennes</span>
            <span className="block text-[11px] text-muted-foreground">
              Rappel le soir (cet appareil) s&apos;il reste des cartes à revoir
            </span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {state === "loading" && <span className="text-xs text-muted-foreground">…</span>}

          {state === "unsupported" && (
            <span className="text-xs text-muted-foreground">Non supporté sur ce navigateur</span>
          )}

          {state === "nokeys" && (
            <span className="text-xs text-muted-foreground">À configurer côté serveur</span>
          )}

          {state === "blocked" && (
            <span className="max-w-44 text-right text-xs text-destructive">
              Bloquées dans le navigateur — réautorise-les dans les réglages du site
            </span>
          )}

          {state === "off" && (
            <Button type="button" size="sm" onClick={enable} disabled={busy} className="h-7 rounded-full px-3 text-xs font-semibold">
              <Bell className="mr-1 h-3 w-3" aria-hidden />
              {busy ? "…" : "Activer"}
            </Button>
          )}

          {state === "on" && (
            <>
              <span className="flex h-7 items-center rounded-full bg-matcha/15 px-2.5 text-xs font-semibold text-matcha">
                Activée
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={sendTest}
                disabled={testing}
                className="h-7 rounded-full px-3 text-xs font-semibold"
                title="Recevoir une notification immédiatement pour vérifier"
              >
                {testing ? "…" : "Tester"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={disable}
                disabled={busy}
                className={cn("h-7 rounded-full px-3 text-xs font-semibold text-muted-foreground")}
              >
                Désactiver
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
