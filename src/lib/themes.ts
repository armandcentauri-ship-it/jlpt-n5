/* Thèmes pédagogiques du vocabulaire, dans l'ordre d'apprentissage
 * (du plus général au plus spécial). Générés par scripts/finalize_meta.mjs. */
export const THEMES: { key: string; label: string }[] = [
  { key: "base", label: "Bases & pronoms" },
  { key: "politesse", label: "Salutations & politesse" },
  { key: "famille", label: "Personnes & famille" },
  { key: "nombres", label: "Nombres & quantité" },
  { key: "temps", label: "Temps, jours & dates" },
  { key: "position", label: "Position & direction" },
  { key: "maison", label: "Maison & objets" },
  { key: "nourriture", label: "Nourriture & boissons" },
  { key: "lieux", label: "Lieux & ville" },
  { key: "transport", label: "Voyage & transport" },
  { key: "ecole", label: "École & études" },
  { key: "travail", label: "Travail & société" },
  { key: "corps", label: "Corps & santé" },
  { key: "nature", label: "Nature & météo" },
  { key: "animaux", label: "Animaux" },
  { key: "couleurs", label: "Couleurs & formes" },
  { key: "loisirs", label: "Loisirs & médias" },
  { key: "verbes_base", label: "Verbes essentiels" },
  { key: "verbes_vie", label: "Verbes du quotidien" },
  { key: "verbes_mvt", label: "Verbes de mouvement" },
  { key: "verbes_comm", label: "Verbes de communication" },
  { key: "adjectifs", label: "Adjectifs & description" },
  { key: "adverbes", label: "Adverbes & fréquence" },
  { key: "connecteurs", label: "Connecteurs & grammaire" },
  { key: "divers", label: "Mots abstraits & divers" },
];

const LABEL_BY_KEY = new Map(THEMES.map((t) => [t.key, t.label]));

/** Libellé français d'un thème (fallback si clé inconnue). */
export function themeLabel(key: string | undefined): string {
  if (!key) return "Divers";
  return LABEL_BY_KEY.get(key) ?? key;
}
