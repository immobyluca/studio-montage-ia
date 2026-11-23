// Crée le dossier d'une nouvelle vidéo à partir d'un rush.
// Usage : node outils/nouvelle-video.mjs <rush> [--sujet "estimation"] [--format 9:16|16:9]
//   <rush> : un nom de fichier du dossier a-monter/, ou un chemin complet (disque externe par exemple).
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import { basename, extname, isAbsolute, join, resolve } from "node:path"
import { DOSSIERS, EXT_VIDEO, RACINE, args, dire, rel, sonder, stop, estPrincipal } from "./lib/commun.mjs"
import { MONTAGE_VIDE } from "./lib/montage.mjs"

export function creerVideo(rushArg, { sujet, format } = {}) {
  if (!rushArg) {
    const dispo = existsSync(DOSSIERS.aMonter) ? readdirSync(DOSSIERS.aMonter).filter((f) => EXT_VIDEO.includes(extname(f).toLowerCase())) : []
    stop(`Indique le rush. Rushs dans a-monter/ : ${dispo.length ? dispo.join(", ") : "aucun (dépose ta vidéo dans le dossier a-monter)"}`)
  }
  let rush = isAbsolute(rushArg) ? rushArg : existsSync(join(DOSSIERS.aMonter, rushArg)) ? join(DOSSIERS.aMonter, rushArg) : resolve(RACINE, rushArg)
  if (!existsSync(rush)) stop(`Rush introuvable : ${rushArg}`)
  const info = sonder(rush)
  if (!info.video) stop("Ce fichier ne contient pas d'image vidéo.")
  if (!info.audio) stop("Ce rush n'a pas de son : impossible de couper sur la voix.")
  const fmt = format ?? (info.largeur > info.hauteur ? "16:9" : "9:16")
  const propre = (sujet || basename(rush, extname(rush))).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "video"
  const jour = new Date().toISOString().slice(0, 10)
  let id = `${jour}_${propre}`, n = 2
  while (existsSync(join(DOSSIERS.videos, id))) id = `${jour}_${propre}-${n++}`
  const d = join(DOSSIERS.videos, id)
  mkdirSync(join(d, "export"), { recursive: true })
  const dansStudio = rush.startsWith(RACINE)
  const montage = { ...structuredClone(MONTAGE_VIDE), id, titre: sujet || propre.replace(/-/g, " "), format: fmt, rush: dansStudio ? rel(rush) : rush, cree: new Date().toISOString(),
    source: { duree: +info.duree.toFixed(3), largeur: info.largeur, hauteur: info.hauteur, ips: +info.ips.toFixed(3), hdr: info.hdr } }
  writeFileSync(join(d, "montage.json"), JSON.stringify(montage, null, 2) + "\n")
  writeFileSync(join(d, "brief.md"), `# ${montage.titre}\n\nFormat : ${fmt}\nRush : ${montage.rush}\n\nCe que je veux dire :\n\nAccroche (titre des 2 premières secondes) :\n\nAppel à l'action de la fin :\n`)
  writeFileSync(join(d, "demandes.md"), `# Demandes pour l'IA\n\nÉcris ici (ou depuis le dashboard) ce que tu veux changer. L'IA coche ce qu'elle a fait.\n`)
  return { id, montage, info }
}

if (estPrincipal(import.meta.url)) {
  const a = args()
  const { id, info } = creerVideo(a._[0], { sujet: a.sujet, format: a.format })
  dire(`Vidéo créée : videos/${id}/`)
  dire(`Rush : ${Math.round(info.duree)} s, ${info.largeur}x${info.hauteur}, ${info.ips.toFixed(2)} i/s${info.hdr ? ", HDR (converti en SDR au rendu)" : ""}`)
  dire(`Étape suivante : node outils/transcrire.mjs ${id}`)
}
