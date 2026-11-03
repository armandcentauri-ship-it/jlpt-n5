import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

/* Fonts auto-hébergées (subsets woff2 générés par scripts/build-fonts.sh) :
   aucun téléchargement au build — déploiement fiable même sans réseau. */
const rounded = localFont({
  src: "./fonts/Nunito-Variable.woff2",
  variable: "--font-rounded",
  weight: "400 700",
  display: "swap",
});

const jpFont = localFont({
  src: [
    { path: "./fonts/ZenKakuGothicNew-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ZenKakuGothicNew-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ZenKakuGothicNew-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "日本語 N5 — Kanji N5 + N4, vocabulaire & révision",
  description:
    "Application d'apprentissage du japonais niveau JLPT N5 : 251 kanji (N5 + N4), 1054 mots de vocabulaire, flashcards SRS type Anki et exercices de traduction JP⇄FR.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%23c73e3a'/%3E%3Ctext x='16' y='22' font-size='16' text-anchor='middle' fill='white' font-family='serif'%3E日%3C/text%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f1e6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${rounded.variable} ${jpFont.variable} font-sans antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
