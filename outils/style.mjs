// Aide pour « Crée ton style ».
// Usage : node outils/style.mjs couleurs <capture.png|jpg>   couleurs dominantes d'une capture (profil Instagram, logo…)
//         node outils/style.mjs verifier                      lisibilité de mon-style/charte.json (contrastes, fichiers)
import { existsSync } from "node:fs"
import { join } from "node:path"
import { DOSSIERS, abs, args, dire, estPrincipal, ffmpeg, ffmpegChemin, lireJson, stop } from "./lib/commun.mjs"
import { spawnSync } from "node:child_process"

const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase()
const rgb = (h) => { const n = parseInt(String(h).replace("#", ""), 16); return [n >> 16, (n >> 8) & 255, n & 255] }
const lum = (c) => { const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
export const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

/** Couleurs dominantes : l'image est réduite à 48x48, puis regroupée en 6 familles (k-moyennes). */
export async function couleurs(fichier) {
  if (!existsSync(fichier)) stop(`Image introuvable : ${fichier}`)
  const r = spawnSync(ffmpegChemin(), ["-v", "error", "-i", fichier, "-vf", "scale=48:48:flags=area,format=rgb24", "-f", "rawvideo", "-"], { maxBuffer: 1e7 })
  if (r.status !== 0) stop("Impossible de lire l'image (formats acceptés : png, jpg, webp).")
  const px = []
  for (let i = 0; i + 2 < r.stdout.length; i += 3) px.push([r.stdout[i], r.stdout[i + 1], r.stdout[i + 2]])
  let centres = Array.from({ length: 6 }, (_, k) => px[Math.floor((k * px.length) / 6)])
  let groupes = []
  for (let it = 0; it < 12; it++) {
    groupes = centres.map(() => [])
    for (const p of px) { let b = 0, d = Infinity; centres.forEach((c, k) => { const e = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (e < d) { d = e; b = k } }); groupes[b].push(p) }
    centres = groupes.map((g, k) => (g.length ? [0, 1, 2].map((j) => g.reduce((s, p) => s + p[j], 0) / g.length) : centres[k]))
  }
  return centres.map((c, k) => ({ couleur: hex(c), part: Math.round((100 * groupes[k].length) / px.length) })).filter((x) => x.part > 0).sort((a, b) => b.part - a.part)
}

export function verifierCharte() {
  const c = lireJson(join(DOSSIERS.style, "charte.json"))
  if (!c) stop("mon-style/charte.json est illisible (virgule ou guillemet manquant ?).")
  const C = c.couleurs ?? {}, pb = []
  const paires = [["texte", "surface", "texte sur les cartes"], ["texte_accent", "accent", "texte sur la capsule d'accent"], ["texte_clair", "clair", "texte sur carte mise en avant"], ["texte_attention", "attention", "texte sur barré"]]
  for (const [t, f, nom] of paires) {
    if (!/^#[0-9a-f]{6}$/i.test(C[t] ?? "") || !/^#[0-9a-f]{6}$/i.test(C[f] ?? "")) { pb.push(`${nom} : couleur au mauvais format (attendu #RRGGBB)`); continue }
    const k = contraste(C[t], C[f])
    if (k < 4.5) pb.push(`${nom} : contraste ${k.toFixed(1)} (il faut au moins 4,5, sinon c'est illisible sur téléphone)`)
  }
  for (const [role, p] of Object.entries(c.polices ?? {})) if (p.fichier && !existsSync(abs(p.fichier))) pb.push(`police ${role} introuvable : ${p.fichier}`)
  if (c.logo && !existsSync(abs(c.logo))) pb.push(`logo introuvable : ${c.logo}`)
  return pb
}

if (estPrincipal(import.meta.url)) {
  const a = args()
  if (a._[0] === "couleurs") {
    const r = await couleurs(a._[1])
    dire("Couleurs dominantes (de la plus présente à la moins présente) :")
    for (const x of r) dire(`  ${x.couleur}  ${String(x.part).padStart(3)} %  (contraste avec le blanc ${contraste(x.couleur, "#FFFFFF").toFixed(1)}, avec le noir ${contraste(x.couleur, "#000000").toFixed(1)})`)
  } else if (a._[0] === "verifier") {
    const pb = verifierCharte()
    dire(pb.length ? `À corriger :\n${pb.map((x) => "  - " + x).join("\n")}` : "Charte lisible : contrastes et fichiers OK. Lance node outils/galerie.mjs pour la voir.")
    process.exit(pb.length ? 1 : 0)
  } else stop("Usage : node outils/style.mjs couleurs <image>   ou   node outils/style.mjs verifier")
}
export { ffmpeg }
