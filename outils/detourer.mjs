// Détourage (option) : découpe ta silhouette image par image pour poser des animations DERRIÈRE toi
// et flouter le fond. Marche sur Mac et Windows (modèle d'IA local de HyperFrames, rien n'est envoyé en ligne).
// Usage : node outils/detourer.mjs <video> [--appareil auto|cpu|coreml|cuda]
// C'est long : compte 1 à 3 minutes par tranche de 10 s de vidéo sur un ordinateur portable sans carte graphique.
// À refaire après chaque changement de coupes (le rendu te prévient).
import { existsSync, statSync } from "node:fs"
import { join } from "node:path"
import { args, dire, ecrireJson, hms, hyperframes, stop, estPrincipal } from "./lib/commun.mjs"
import { ecrireMontage, lireMontage } from "./lib/montage.mjs"
import { fabriquerPlaque } from "./rendre.mjs"

export async function detourer(id, o = {}) {
  const journal = o.journal ?? dire
  const t0 = Date.now()
  journal("1/2 Vidéo coupée (plaque)…")
  const { travail, plaque, clePlaque, duree } = await fabriquerPlaque(id, { journal })
  const sujet = join(travail, "sujet.webm")
  journal(`2/2 Détourage de ${hms(duree)} de vidéo (long, laisse tourner)…`)
  // WebM transparent : environ 40 fois plus léger que du ProRes 4444 (15 Mo au lieu de 560 Mo pour 8 s)
  const r = await hyperframes(["remove-background", plaque, "-o", sujet, "--device", o.appareil ?? "auto", "--quality", "best"],
    { surErreur: (t) => { const p = /(\d+)\s*\/\s*(\d+)/.exec(t); if (p && Number(p[1]) % 150 === 0) journal(`   ${p[1]}/${p[2]} images`) } })
  if (r.code !== 0 || !existsSync(sujet)) stop(`Le détourage a échoué :\n${(r.erreurs || r.sortie).split("\n").slice(-12).join("\n")}\nLe montage marche sans : les animations « derriere » passent alors devant.`)
  ecrireJson(sujet + ".json", { plaque: clePlaque, date: new Date().toISOString() })
  const m = lireMontage(id); m.detourage = true; ecrireMontage(id, m)
  journal(`Détourage prêt (${Math.round(statSync(sujet).size / 1e6)} Mo, ${Math.round((Date.now() - t0) / 1000)} s). Les animations « derriere » passeront derrière toi au prochain rendu.`)
}

if (estPrincipal(import.meta.url)) {
  const a = args()
  if (!a._[0]) stop("Usage : node outils/detourer.mjs <video>")
  await detourer(a._[0], { appareil: a.appareil })
}
