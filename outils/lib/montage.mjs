// Le montage d'une vidéo : lecture de montage.json, morceaux gardés, mots replacés sur la frise.
// Tous les temps « source » sont en secondes dans le rush ; les temps « frise » dans la vidéo montée.
import { existsSync } from "node:fs"
import { join } from "node:path"
import { DOSSIERS, FPS, arrondiImage, dossierVideo, ecrireJson, lireJson, stop } from "./commun.mjs"

export const MONTAGE_VIDE = {
  version: 1,
  titre: "",
  format: "9:16",
  rush: null,
  reglages_coupes: { pause: 0.45, marge_avant: 0.06, marge_apres: 0.08, choix: "derniere" },
  prises: [],
  zooms: { actif: true, motif: [1.0, 1.15], ancre: [0.5, 0.3], accroche: true, duree_min: 0.8 },
  accroche: { texte: "", debut: 0, fin: 2.5 },
  sous_titres: { actif: true, masquer_pendant_accroche: true },
  remplacements: {},
  animations: [],
  sons: [],
  sons_auto: true,
  musique: { fichier: null, volume: -26 },
  detourage: false,
  rendu: { lufs: -14 },
}

export function lireMontage(id) {
  const d = dossierVideo(id)
  const m = lireJson(join(d, "montage.json"))
  if (!m) stop(`montage.json est absent ou illisible dans videos/${id}/. Recrée la vidéo avec : node outils/nouvelle-video.mjs`)
  // valeurs par défaut pour les champs oubliés (un montage écrit à la main reste valable)
  for (const [k, v] of Object.entries(MONTAGE_VIDE)) if (m[k] === undefined) m[k] = structuredClone(v)
  for (const k of ["reglages_coupes", "zooms", "accroche", "sous_titres", "rendu"]) m[k] = { ...MONTAGE_VIDE[k], ...m[k] }
  return m
}
export const ecrireMontage = (id, m) => ecrireJson(join(dossierVideo(id), "montage.json"), m)

export function lireTranscription(id) {
  const f = join(dossierVideo(id), "transcription.json")
  return existsSync(f) ? lireJson(f) : null
}

export const dimensions = (format) => (format === "16:9" ? [1920, 1080] : [1080, 1920])

/** Morceaux de rush gardés, dans l'ordre, avec leur place sur la frise et leur zoom.
 *  Chaque prise gardée apporte ses morceaux (ses blocs de parole), bornés par [debut, fin]. */
export function morceaux(m) {
  const { marge_avant = 0.06, marge_apres = 0.08 } = m.reglages_coupes ?? {}
  const liste = []
  for (const p of m.prises.filter((x) => x.garder)) {
    const bruts = p.morceaux?.length ? p.morceaux : [[p.debut, p.fin]]
    for (const [a0, b0] of bruts) {
      const a = Math.max(p.debut, a0), b = Math.min(p.fin, b0)
      if (b - a < 0.05) continue
      liste.push({ prise: p.id, src: [Math.max(0, a - marge_avant), b + marge_apres] })
    }
  }
  // deux morceaux qui se chevauchent dans le rush (marges) : on les recolle
  const fus = []
  for (const x of liste) {
    const d = fus.at(-1)
    if (d && x.src[0] <= d.src[1] + 0.02 && x.src[0] >= d.src[0]) d.src[1] = Math.max(d.src[1], x.src[1])
    else fus.push({ ...x, src: [...x.src] })
  }
  // à l'image près, et place sur la frise
  let t = 0
  for (const x of fus) {
    x.src = [arrondiImage(x.src[0]), arrondiImage(x.src[1])]
    const d = x.src[1] - x.src[0]
    x.tl = [t, arrondiImage(t + d)]
    t = x.tl[1]
  }
  // zoom alterné à chaque coupe (sauf morceaux trop courts : on garde le zoom d'avant)
  const z = m.zooms ?? {}
  const motif = z.actif === false ? [1] : z.motif?.length ? z.motif : [1]
  let k = 0
  fus.forEach((x, i) => {
    if (i > 0 && x.tl[1] - x.tl[0] >= (z.duree_min ?? 0.8)) k++
    x.zoom = motif[k % motif.length]
    if (x.zoom_force) x.zoom = x.zoom_force
  })
  return fus
}

export const dureeMontage = (m) => morceaux(m).at(-1)?.tl[1] ?? 0

/** Source → frise. Renvoie null si l'instant a été coupé. */
export function versFrise(pieces, t) {
  for (const x of pieces) if (t >= x.src[0] - 1e-6 && t <= x.src[1] + 1e-6) return x.tl[0] + (t - x.src[0])
  return null
}
/** Frise → source. */
export function versSource(pieces, t) {
  const x = pieces.find((p) => t >= p.tl[0] && t < p.tl[1]) ?? pieces.at(-1)
  return x ? x.src[0] + Math.min(t - x.tl[0], x.src[1] - x.src[0]) : 0
}

/** Mots des prises gardées, replacés sur la frise, avec les remplacements (« trains » → « trends »). */
export function motsFrise(m, transcription) {
  if (!transcription?.mots?.length) return []
  const pieces = morceaux(m)
  const remp = Object.entries(m.remplacements ?? {})
  const out = []
  for (const w of transcription.mots) {
    const milieu = (w.debut + w.fin) / 2
    const x = pieces.find((p) => milieu >= p.src[0] && milieu <= p.src[1])
    if (!x) continue
    let texte = w.texte
    for (const [faux, bon] of remp) {
      const nu = texte.replace(/[.,!?…;:]+$/, "")
      if (nu.toLowerCase() === faux.toLowerCase()) texte = bon + texte.slice(nu.length)
    }
    const debut = Math.max(x.tl[0], x.tl[0] + (w.debut - x.src[0]))
    const fin = Math.min(x.tl[1], x.tl[0] + (w.fin - x.src[0]))
    out.push({ texte, debut: +debut.toFixed(3), fin: +Math.max(fin, debut + 0.05).toFixed(3), prise: x.prise })
  }
  // majuscule après un point (une prise suivante peut commencer en minuscule)
  out.forEach((w, i) => { if (i > 0 && /[.!?]$/.test(out[i - 1].texte) && /^[a-zàâéèêëîïôöùûüç]/.test(w.texte)) w.texte = w.texte[0].toUpperCase() + w.texte.slice(1) })
  return out
}

/** Un temps de montage.json : un nombre (secondes sur la frise) ou un repère sur un mot :
 *  "mot:mandat" (début du premier mot qui commence par « mandat »), "mot:mandat@12" (après 12 s),
 *  "mot:mandat+0.3" ou "mot:mandat-0.2" (décalage), "fin:mandat" (fin du mot). */
export function resoudreTemps(v, mots, defaut = 0, duree = null) {
  if (typeof v === "number") return v
  if (typeof v !== "string") return defaut
  const f = /^fin\s*([+-]\s*[\d.]+)?$/.exec(v.trim())          // "fin" ou "fin-2.5" : fin de la vidéo
  if (f && duree != null) return duree + Number((f[1] ?? "0").replace(/\s/g, ""))
  const r = /^(mot|fin):(.+?)(?:@([\d.]+))?([+-]\d+(?:\.\d+)?)?$/.exec(v.trim())
  if (!r) { const n = Number(v); return Number.isFinite(n) ? n : defaut }
  const [, quoi, cible, apres, decal] = r
  // « s'épuiser » se trouve aussi avec « épuiser » (l', d', s', qu'… retirés au début)
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’]/g, "'").replace(/[^a-z0-9%€'-]/g, "").replace(/^(?:qu|[cdjlmnst])'/, "")
  const c = norm(cible)
  const w = mots.find((x) => norm(x.texte).startsWith(c) && x.debut >= Number(apres ?? 0) - 1e-6)
  if (!w) { console.warn(`  attention : repère « ${v} » introuvable dans les mots, remplacé par ${defaut} s`); return defaut }
  return (quoi === "fin" ? w.fin : w.debut) + Number(decal ?? 0)
}

export const FPS_MONTAGE = FPS
export { DOSSIERS }
