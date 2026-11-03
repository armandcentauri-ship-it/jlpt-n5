// Post-build : copie les assets vers .next/standalone/ UNIQUEMENT en mode "standalone"
// (runtime local). Sur Vercel, output: "standalone" est désactivé dans next.config.ts,
// le dossier n'existe pas et il n'y a rien à copier — le build doit réussir quand même.
import { existsSync, cpSync } from 'node:fs'

if (existsSync('.next/standalone')) {
  cpSync('.next/static', '.next/standalone/.next/static', { recursive: true })
  cpSync('public', '.next/standalone/public', { recursive: true })
  console.log('post-build : assets copiés vers .next/standalone/ ✓')
} else {
  console.log('post-build : pas de mode standalone (Vercel), rien à copier ✓')
}
