#!/usr/bin/env node
/* Corrige les sens FR/EN des kanji dans la DB :
   - base = sens FR officiels de KANJIDIC2 (/tmp/kanjidic_fr.json)
   - surcharge manuelle quand le choix/order officiel est trompeur pour un apprenant N5/N4
   - supprime les notes "radical ... (no. X)"
   - reconstruit meaningsEn (sens EN officiels KANJIDIC2)
   - plafonne à 4 sens FR / 3 sens EN
   Usage : node scripts/fix_kanji_meanings.mjs [--dry]
*/
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const DRY = process.argv.includes("--dry");

/* ---- Surcharges manuelles : le 1er sens = sens principal appris au niveau JLPT ---- */
const OVERRIDES = {
  // N5
  一: ["un"],
  二: ["deux"],
  八: ["huit"],
  千: ["mille"],
  万: ["dix mille"],
  午: ["midi"],
  休: ["se reposer", "pause", "vacances"],
  校: ["école"],
  空: ["ciel", "vide"],
  本: ["livre", "origine", "principal"],
  行: ["aller", "effectuer", "rangée"],
  来: ["venir", "prochain"],
  間: ["entre", "intervalle", "pièce (chambre)"],
  道: ["chemin", "route", "voie"],
  安: ["pas cher", "paisible", "calme"],
  語: ["langue", "mot", "parler"],
  駅: ["gare", "station"],
  会: ["réunion", "rencontrer", "association"],
  見: ["voir", "regarder"],
  足: ["jambe", "pied", "suffire"],
  立: ["se lever", "être debout"],
  金: ["or", "argent (monnaie)"],
  社: ["entreprise", "sanctuaire"],
  生: ["vie", "naître", "cru"],
  天: ["ciel"],
  円: ["yen", "cercle", "rond"],
  学: ["étudier", "science"],
  外: ["extérieur", "dehors", "autre"],
  古: ["vieux", "ancien"],
  食: ["manger", "repas"],
  書: ["écrire"],
  言: ["dire"],
  // N4
  力: ["force", "puissance"],
  京: ["capitale"],
  夕: ["soir"],
  正: ["correct", "juste"],
  字: ["caractère", "écriture"],
  町: ["ville", "quartier"],
  工: ["artisanat", "usine", "travail"],
  方: ["direction", "manière", "personne (poli)"],
  元: ["origine", "source", "début"],
  台: ["support", "socle", "compteur pour machines"],
  地: ["terre", "sol", "terrain"],
  考: ["penser", "réfléchir", "considérer"],
  作: ["fabriquer", "faire", "créer"],
  図: ["plan", "carte", "figure"],
  明: ["lumineux", "clair", "brillant"],
  画: ["image", "dessin", "trait"],
  室: ["pièce", "chambre"],
  昼: ["midi", "journée"],
  計: ["plan", "calcul", "mesure"],
  帰: ["rentrer", "retourner"],
  通: ["passer", "circuler", "conduire à"],
  理: ["raison", "logique", "principe"],
  野: ["plaine", "champ", "sauvage"],
  場: ["endroit", "lieu", "place"],
  答: ["réponse", "solution"],
  楽: ["musique", "plaisir", "confort"],
  世: ["monde", "société", "génération"],
  主: ["maître", "principal", "hôte"],
  仕: ["servir", "être employé"],
  代: ["remplacer", "ère", "prix"],
  写: ["copier", "photographier"],
  去: ["partir", "s'en aller"],
  有: ["posséder", "exister"],
  死: ["mourir", "mort"],
  医: ["médecin", "docteur"],
  究: ["rechercher", "étudier à fond"],
  事: ["chose", "affaire", "fait"],
  者: ["personne", "celui qui"],
  味: ["saveur", "goût"],
  注: ["verser", "attention (注意)"],
  物: ["chose", "objet"],
  発: ["départ", "émission"],
  品: ["article", "produit", "qualité"],
  屋: ["toit", "magasin", "boutique"],
  度: ["fois", "degré", "température"],
  洋: ["océan", "occidental"],
  界: ["monde", "domaine"],
  研: ["polir", "recherche (研究)"],
  送: ["envoyer", "escorter"],
  重: ["lourd", "important", "superposer"],
  員: ["membre", "personnel"],
  真: ["vrai", "réel"],
  起: ["se lever", "se produire", "réveiller"],
  動: ["bouger", "mouvoir"],
  族: ["famille", "groupe", "tribu"],
  終: ["fin", "finir"],
  習: ["apprendre"],
  転: ["tourner", "rouler"],
  着: ["porter (un vêtement)", "arriver", "attacher"],
  運: ["transporter", "porter", "chance", "destin"],
  集: ["rassembler", "collecter"],
  業: ["travail", "métier", "entreprise"],
  意: ["idée", "intention", "sens"],
  題: ["sujet", "thème", "titre"],
  不: ["négation", "non-", "sans"],
  以: ["avec", "au moyen de", "à partir de"],
  別: ["séparer", "autre", "distinction"],
  的: ["cible", "objectif", "suffixe -ique"],
  英: ["Angleterre", "anglais"],
  料: ["frais", "tarif"],
  特: ["spécial"],
  無: ["sans", "néant", "non-"],
  飯: ["repas", "riz cuit"],
  試: ["test", "essai"],
  験: ["test", "essai", "vérification"],
  可: ["acceptable", "possible", "approbation"],
  貸: ["prêter"],
  質: ["qualité", "substance", "matière"],
  私: ["moi, je", "privé"],
  映: ["se refléter", "projeter (un film)"],
  持: ["tenir", "garder"],
  知: ["savoir", "connaître"],
  音: ["son", "bruit"],
  強: ["fort", "solide"],
  家: ["maison", "famille"],
  身: ["corps"],
};

const RADICAL_NOTE = /radical .+\(no\.\s*\d+\)/i;

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: "file:/home/z/my-project/db/custom.db" } },
  });
  const kanjidic = JSON.parse(readFileSync("/tmp/kanjidic_fr.json", "utf8"));
  const kanji = await prisma.kanji.findMany();

  let fixedFr = 0;
  let fixedEn = 0;
  let scrubbed = 0;

  for (const k of kanji) {
    let fr = [];
    let en = [];
    try { fr = JSON.parse(k.meaningsFr); } catch {}
    try { en = JSON.parse(k.meaningsEn); } catch {}
    if (!Array.isArray(fr)) fr = [];
    if (!Array.isArray(en)) en = [];

    const beforeFr = fr.join("|");
    const beforeEn = en.join("|");

    // 1) note de radical -> retirée
    const scrubbedList = fr.filter((m) => typeof m === "string" && !RADICAL_NOTE.test(m));
    if (scrubbedList.length !== fr.length) scrubbed++;

    // 2) base officielle KANJIDIC2 FR, puis surcharge manuelle
    const kd = kanjidic[k.character];
    const kdFr = (kd?.fr ?? []).filter((m) => typeof m === "string" && !RADICAL_NOTE.test(m));
    let frFinal = OVERRIDES[k.character] ?? (kdFr.length ? kdFr : scrubbedList);

    // 3) plafond 4 sens, dédoublonnage
    frFinal = [...new Set(frFinal.filter(Boolean))].slice(0, 4);
    if (!frFinal.length) frFinal = scrubbedList.slice(0, 4);

    // 4) EN officiel KANJIDIC2 (cap 3)
    let enFinal = en;
    if (kd?.en?.length) {
      enFinal = [...new Set(kd.en.filter(Boolean))].slice(0, 3);
    }

    if (frFinal.join("|") !== beforeFr || enFinal.join("|") !== beforeEn) {
      if (frFinal.join("|") !== beforeFr) fixedFr++;
      if (enFinal.join("|") !== beforeEn) fixedEn++;
      if (!DRY) {
        await prisma.kanji.update({
          where: { id: k.id },
          data: {
            meaningsFr: JSON.stringify(frFinal),
            meaningsEn: JSON.stringify(enFinal),
          },
        });
      }
      console.log(`${k.character}  FR: [${frFinal.join(" ; ")}]   EN: [${enFinal.join(" ; ")}]`);
    }
  }

  console.log(`\nRésumé : FR modifiés=${fixedFr}, EN reconstruits=${fixedEn}, notes radical supprimées=${scrubbed}, dry=${DRY}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
