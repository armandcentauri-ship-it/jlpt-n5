# 🚀 Déploiement — GitHub → Turso → Vercel

L'app fonctionne sans login : **tout le monde partage la même progression** (profil unique, SM-2). La base distante **Turso** (SQLite hébergé, compatible Prisma) est obligatoire sur Vercel — un fichier SQLite n'y est pas persistant.

## 0. Prérequis

- Un compte [GitHub](https://github.com), un compte [Vercel](https://vercel.com) (connexion avec GitHub), un compte [Turso](https://turso.tech)
- Node.js ≥ 20 sur ta machine (`node -v`)

## 1. Récupérer le code et l'envoyer sur GitHub

Le code arrive sous forme d'un « bundle » git (`jlpt-app.bundle`) :

```bash
git clone jlpt-app.bundle mon-jlpt && cd mon-jlpt
git branch --show-current        # → main
```

Crée ensuite un dépôt **vide** sur github.com (New repository, sans README ni .gitignore), puis :

```bash
git remote add origin https://github.com/<TON_USER>/<TON_REPO>.git
git push -u origin main
```

## 2. Créer la base Turso et y copier les données

Installe le CLI Turso (`brew install tursodatabase/tap/turso` sur macOS, ou voir turso.tech), puis :

```bash
turso auth login
turso db create jlpt-n5                 # + --location fra1 pour l'Europe de l'Ouest
turso db show jlpt-n5 --url             # → TURSO_DATABASE_URL  (libsql://…)
turso db tokens create jlpt-n5          # → TURSO_AUTH_TOKEN    (eyJ…)
```

Copie le contenu de la base (1043 mots, 251 kanji, ta progression) :

```bash
npm install
TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="eyJ…" npm run db:to-turso
```

Vérification rapide : `turso db shell jlpt-n5 "SELECT COUNT(*) FROM Word"` → `1054`.

## 3. Importer le projet dans Vercel

1. vercel.com → **Add New → Project** → sélectionne le repo GitHub
2. Framework détecté : **Next.js** (laisser les réglages par défaut)
3. **Environment Variables** (cocher Production + Preview) :

| Variable | Valeur |
| --- | --- |
| `TURSO_DATABASE_URL` | `libsql://jlpt-n5-….turso.io` |
| `TURSO_AUTH_TOKEN` | `eyJ…` |
| `DATABASE_URL` | `file:./db/custom.db` *(placeholder, non utilisé en mode Turso)* |

4. **Deploy** (~2-3 min)

À chaque `git push` sur `main`, Vercel redéploiera automatiquement.

## 4. Vérifier

- Ouvre l'URL `https://<projet>.vercel.app`
- Lance une session de révision, note une carte, **rafraîchis la page** : la progression doit rester
- Le tableau de bord doit afficher les barres 单語 / 漢字 à jour

## Dépannage

| Symptôme | Solution |
| --- | --- |
| `Environment variable not found: DATABASE_URL` | Les 3 variables ne sont pas (ou mal) définies dans Vercel → corriger et redéployer |
| Erreur 401 / `UNAUTHORIZED` de Turso | Token expiré → `turso db tokens create jlpt-n5` et mettre à jour la variable |
| Contenu vide sur le site | Relancer `npm run db:to-turso` (il recrée tout à l'identique) |
| La progression ne persiste pas | Vérifier que `TURSO_DATABASE_URL` commence bien par `libsql://` |
| Base Turso à jour après un changement de contenu local | Repousser le code **puis** relancer `npm run db:to-turso` |

## Développement local

```bash
npm install        # génère le client Prisma (postinstall)
npm run dev        # http://localhost:3000
```

Sans variables Turso, l'app utilise le SQLite fichier local (`db/custom.db`, via `DATABASE_URL`). Pour travailler sur les données de production : copie `.env.example` en `.env` et renseigne les variables `TURSO_*`.
