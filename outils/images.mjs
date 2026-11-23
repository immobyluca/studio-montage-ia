// Planche d'images tirées de l'aperçu (ou du rendu final) pour vérifier d'un coup d'œil :
// visage jamais caché, textes lisibles, rien sous l'interface d'Instagram.
// Usage : node outils/images.mjs <video> [t1 t2 ...] [--final]
//   Sans instants : une image toutes les 2 s environ, plus le milieu de chaque animation.
// Sortie : videos/<video>/planche.jpg (un repère de temps est écrit sous chaque image)
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { abs, args, dire, dossierVideo, ffmpeg, lireJson, rel, sonder, stop, estPrincipal } from "./lib/commun.mjs"

export async function planche(id, instants = [], o = {}) {
  const d = dossierVideo(id)
  const source = o.final ? abs(lireJson(join(d, "rendu.json"))?.fichier ?? "") : join(d, "apercu.mp4")
  if (!source || !existsSync(source)) stop(o.final ? "Pas encore de rendu final." : `Pas encore d'aperçu. Lance : node outils/rendre.mjs ${id} --apercu`)
  const info = sonder(source), duree = info.duree
  const hCase = 2 * Math.round((270 * info.hauteur) / info.largeur / 2) + 30
  let ts = instants.map(Number).filter((t) => Number.isFinite(t) && t >= 0 && t < duree)
  if (!ts.length) {
    const n = Math.min(16, Math.max(6, Math.round(duree / 2)))
    ts = Array.from({ length: n }, (_, i) => +(0.15 + (i * (duree - 0.3)) / (n - 1)).toFixed(2))
  }
  const tmp = mkdtempSync(join(tmpdir(), "planche-"))
  const imgs = []
  for (const [k, t] of ts.entries()) {
    const f = join(tmp, `i${k}.png`)
    await ffmpeg(["-y", "-v", "error", "-ss", String(t), "-i", source, "-frames:v", "1", "-vf", "scale=270:-2", f])
    imgs.push(f)
  }
  const col = Math.min(8, imgs.length), lignes = Math.ceil(imgs.length / col)
  const ins = imgs.flatMap((f) => ["-i", f])
  const filtres = imgs.map((_, i) => `[${i}:v]pad=iw+6:ih+30:3:3:color=white,drawtext=text='${ts[i].toFixed(1)} s':x=8:y=h-24:fontsize=18:fontcolor=black,format=rgb24[e${i}]`)
  while (filtres.length < col * lignes) { const i = filtres.length; filtres.push(`color=white:s=276x${hCase}:d=1,format=rgb24[e${i}]`) }
  const lignesF = Array.from({ length: lignes }, (_, l) => `${Array.from({ length: col }, (_, c) => `[e${l * col + c}]`).join("")}hstack=inputs=${col}[l${l}]`)
  const fc = [...filtres, ...lignesF, lignes > 1 ? `${Array.from({ length: lignes }, (_, l) => `[l${l}]`).join("")}vstack=inputs=${lignes}[o]` : "[l0]null[o]"].join(";")
  const sortie = join(d, "planche.jpg")
  const r = await ffmpeg(["-y", "-v", "error", ...ins, "-filter_complex", fc, "-map", "[o]", "-frames:v", "1", "-q:v", "3", sortie], { tolerer: true })
  if (r.code !== 0) {   // ffmpeg sans drawtext (police absente) : planche sans repères
    const fc2 = fc.replace(/,drawtext=[^\[]+/g, "")
    await ffmpeg(["-y", "-v", "error", ...ins, "-filter_complex", fc2, "-map", "[o]", "-frames:v", "1", "-q:v", "3", sortie])
  }
  rmSync(tmp, { recursive: true, force: true })
  return { fichier: rel(sortie), instants: ts }
}

if (estPrincipal(import.meta.url)) {
  const a = args()
  if (!a._[0]) stop("Usage : node outils/images.mjs <video> [t1 t2 ...] [--final]")
  const r = await planche(a._[0], a._.slice(1), { final: Boolean(a.final) })
  dire(`Planche : ${r.fichier} (instants : ${r.instants.join(", ")} s)`)
}
