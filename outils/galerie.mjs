// Galerie du kit : toutes les animations l'une après l'autre, avec TON style (mon-style/charte.json),
// sur un fond neutre. À relancer après chaque changement de style pour voir le résultat.
// Usage : node outils/galerie.mjs [--format 9:16|16:9]
// Sortie : mon-style/galerie.mp4 et mon-style/galerie.jpg (une image par animation)
import { existsSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { DOSSIERS, args, dire, ecrireJson, ffmpeg, hyperframes, lireJson, stop, estPrincipal } from "./lib/commun.mjs"
import { ecrireCalque, lireCharte } from "./calques.mjs"

export async function galerie(o = {}) {
  const journal = o.journal ?? dire
  const charte = lireCharte()
  const cat = lireJson(join(DOSSIERS.kit, "animations.json"))?.animations ?? {}
  const V = (o.format ?? "9:16") !== "16:9"
  const [L, H] = V ? [1080, 1920] : [1920, 1080]
  const SLOT = 3.4, ACC = 2.6, ST = 3.2
  const types = Object.keys(cat).filter((t) => t !== "image")
  const animations = [], etiquettes = [{ texte: "Titre d'accroche", debut: 0, fin: ACC }, { texte: "Sous-titres mot à mot", debut: ACC, fin: ACC + ST }]
  let t = ACC + ST
  types.forEach((type, i) => {
    const params = structuredClone(cat[type].exemple?.params ?? {})
    const nettoyer = (x) => { for (const k of Object.keys(x)) { if (/^(t|au|deflou|t_\w+)$/.test(k)) delete x[k]; else if (Array.isArray(x[k])) x[k].forEach((e) => e && typeof e === "object" && nettoyer(e)) } }
    nettoyer(params)
    if (type === "liste") params.ouvert = 2
    animations.push({ id: `g${i}`, type, debut: +(t + 0.15).toFixed(2), fin: +(t + SLOT - 0.1).toFixed(2), place: cat[type].place === "derriere" ? "devant" : cat[type].place, params, couche: "avant", masquer_sous_titres: true })
    etiquettes.push({ texte: cat[type].nom, debut: t, fin: t + SLOT })
    t += SLOT
  })
  const phrase = "Voici tes sous-titres, mot à mot, avec ton style".split(" ")
  const mots = phrase.map((w, k) => ({ texte: w, debut: +(ACC + 0.2 + k * 0.32).toFixed(2), fin: +(ACC + 0.2 + k * 0.32 + 0.28).toFixed(2) }))
  const st = charte.sous_titres ?? {}
  const D = {
    couche: "avant", duree: +t.toFixed(2), largeur: L, hauteur: H, detourage: false, fond: "linear-gradient(165deg, #2b2b2b 0%, #6b6b6b 55%, #a8a8a8 100%)",
    // sans nom ni compte réglés, la galerie montre un exemple neutre (la vraie vidéo n'affiche que ce qui est réglé)
    charte: { mouvement: charte.mouvement, zones: charte.zones, signature: { ...charte.signature, nom: charte.signature?.nom || "Ton nom", compte: charte.signature?.compte || "@toncompte" } },
    accroche: { texte: "Ton titre\nd'*accroche*", debut: 0, fin: ACC, style: charte.accroche?.style ?? "carte", y: V ? charte.accroche?.y_vertical ?? 282 : charte.accroche?.y_horizontal ?? 80 },
    mots, sous_titres: { actif: true, style: st.style ?? "pilule", y: V ? st.y_vertical ?? 1234 : st.y_horizontal ?? 900, mots_max: st.mots_max ?? 4, caracteres_max: st.caracteres_max ?? 24, masquer: [[0, ACC]] },
    animations, etiquettes,
  }
  const dir = join(DOSSIERS.kit, ".galerie")
  ecrireCalque(dir, D, charte)
  const sortie = join(DOSSIERS.style, "galerie.mp4")
  journal(`Rendu de la galerie (${types.length + 2} éléments, ${Math.round(t)} s)…`)
  const r = await hyperframes(["render", dir, "--format", "mp4", "-o", sortie, "--fps", "30", "--quiet"])
  if (r.code !== 0 || !existsSync(sortie)) stop(`Le rendu de la galerie a échoué :\n${(r.erreurs || r.sortie).split("\n").slice(-12).join("\n")}`)
  // planche : une image au milieu de chaque élément
  const instants = etiquettes.map((e) => +(e.debut + Math.min(2.2, (e.fin - e.debut) * 0.7)).toFixed(2))
  const tmp = join(dir, "images"); mkdirSync(tmp, { recursive: true })
  const imgs = []
  for (const [k, s] of instants.entries()) { const f = join(tmp, `i${k}.png`); await ffmpeg(["-y", "-v", "error", "-ss", String(s), "-i", sortie, "-frames:v", "1", "-vf", `scale=${V ? 270 : 480}:-2`, f]); imgs.push(f) }
  const col = Math.min(7, imgs.length), lignes = Math.ceil(imgs.length / col)
  const fc = imgs.map((_, i) => `[${i}:v]pad=iw+4:ih+4:2:2:color=white,format=rgb24[e${i}]`)
  for (let i = imgs.length; i < col * lignes; i++) fc.push(`[0:v]pad=iw+4:ih+4:2:2:color=white,format=rgb24,drawbox=c=white:t=fill[e${i}]`)
  const ls = Array.from({ length: lignes }, (_, l) => `${Array.from({ length: col }, (_, c) => `[e${l * col + c}]`).join("")}hstack=inputs=${col}[l${l}]`)
  await ffmpeg(["-y", "-v", "error", ...imgs.flatMap((f) => ["-i", f]), "-filter_complex", [...fc, ...ls, lignes > 1 ? `${ls.map((_, l) => `[l${l}]`).join("")}vstack=inputs=${lignes}[o]` : "[l0]null[o]"].join(";"),
    "-map", "[o]", "-frames:v", "1", "-q:v", "3", join(DOSSIERS.style, "galerie.jpg")])
  rmSync(tmp, { recursive: true, force: true })
  ecrireJson(join(DOSSIERS.style, "galerie.json"), { date: new Date().toISOString(), elements: etiquettes })
  journal("Galerie prête : mon-style/galerie.mp4 et mon-style/galerie.jpg")
}

if (estPrincipal(import.meta.url)) {
  const a = args()
  await galerie({ format: a.format })
}
