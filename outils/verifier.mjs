// Vérifie que tout est prêt (Mac et Windows). N'installe rien.
// Usage : node outils/verifier.mjs [--json]
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, statfsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { MAC, RACINE, WIN, args, dossierModeles, ffmpegChemin, ffprobeChemin, filtreDispo, decodeurDispo, hyperframesChemin, lireJson, whisperChemin, estPrincipal } from "./lib/commun.mjs"

const commande = (mac, win, autre) => (MAC ? mac : WIN ? win : autre)

export function verifier() {
  const out = []
  const ajouter = (id, nom, ok, detail, aide = "", obligatoire = true) => out.push({ id, nom, ok, detail, aide, obligatoire })

  const v = process.versions.node.split(".").map(Number)
  ajouter("node", "Node.js 22 ou plus", v[0] >= 22, `version ${process.versions.node}`,
    commande("brew install node", "winget install -e --id OpenJS.NodeJS.LTS", "voir https://nodejs.org"))

  const ff = ffmpegChemin(), fp = ffprobeChemin()
  let vff = ""
  if (ff) vff = (spawnSync(ff, ["-version"], { encoding: "utf8" }).stdout ?? "").split("\n")[0].replace(/ Copyright.*/, "")
  ajouter("ffmpeg", "ffmpeg et ffprobe (coupes, son, rendu)", Boolean(ff && fp), ff ? vff : "introuvable",
    commande("brew install ffmpeg", "winget install -e --id Gyan.FFmpeg", "sudo apt install ffmpeg"))
  if (ff) ajouter("zscale", "ffmpeg sait convertir les vidéos HDR (zscale)", filtreDispo("zscale"), filtreDispo("zscale") ? "oui" : "non : les vidéos HDR de l'iPhone auront des couleurs délavées",
    commande("brew reinstall ffmpeg", "winget install -e --id Gyan.FFmpeg (version complète)", "installe un ffmpeg avec libzimg"), false)
  if (ff) ajouter("vp9", "ffmpeg lit la transparence WebM (libvpx, pour le détourage)", decodeurDispo("libvpx-vp9"), decodeurDispo("libvpx-vp9") ? "oui" : "non : le détourage ne pourra pas être utilisé",
    commande("brew reinstall ffmpeg", "winget install -e --id Gyan.FFmpeg (version complète)", "installe un ffmpeg avec libvpx"), false)

  const hf = hyperframesChemin()
  const vhf = hf ? lireJson(join(RACINE, "node_modules", "hyperframes", "package.json"))?.version : null
  ajouter("hyperframes", "HyperFrames (animations, détourage)", Boolean(hf), hf ? `version ${vhf}` : "pas installé", "npm install (à la racine du studio)")

  const w = whisperChemin()
  ajouter("whisper", "Whisper (transcription sur ton ordinateur)", Boolean(w), w ? "prêt" : "introuvable",
    commande("brew install whisper-cpp", "node outils/installer.mjs (télécharge whisper-cli.exe officiel)", "voir https://github.com/ggml-org/whisper.cpp"))
  const modele = join(dossierModeles(), "ggml-small.bin")
  ajouter("modele", "Modèle de transcription (466 Mo)", existsSync(modele), existsSync(modele) ? "téléchargé" : "se télécharge à la première transcription", "node outils/installer.mjs", false)

  const chrome = join(process.env.HYPERFRAMES_CACHE_DIR || join(homedir(), ".cache", "hyperframes"), "chrome")
  ajouter("chrome", "Navigateur de rendu (HyperFrames)", existsSync(chrome), existsSync(chrome) ? "téléchargé" : "se télécharge au premier rendu", "node node_modules/hyperframes/bin/hyperframes.mjs browser ensure", false)

  try {
    const s = statfsSync(RACINE), libre = (s.bavail * s.bsize) / 1e9
    ajouter("disque", "Espace libre (5 Go conseillés)", libre >= 5, `${libre.toFixed(1)} Go libres`, "Libère de la place ou mets les fichiers lourds sur un disque externe : STUDIO_TRAVAIL=/chemin/du/disque", false)
  } catch {}

  const git = spawnSync(WIN ? "where" : "which", ["git"], { encoding: "utf8" }).status === 0
  ajouter("git", "Git (pour récupérer les mises à jour)", git, git ? "installé" : "absent", commande("xcode-select --install", "winget install -e --id Git.Git", "sudo apt install git"), false)
  return out
}

if (estPrincipal(import.meta.url)) {
  const a = args(), r = verifier()
  if (a.json) { console.log(JSON.stringify(r, null, 2)); process.exit(0) }
  console.log(`Studio de montage IA : vérification (${MAC ? "Mac" : WIN ? "Windows" : process.platform})\n`)
  for (const x of r) console.log(`${x.ok ? "  ✓" : x.obligatoire ? "  ✗" : "  ·"} ${x.nom} : ${x.detail}${x.ok ? "" : `\n      → ${x.aide}`}`)
  const manque = r.filter((x) => !x.ok && x.obligatoire)
  console.log(manque.length ? `\n${manque.length} élément(s) à installer. Lance : node outils/installer.mjs` : "\nTout est prêt. Lance le dashboard : npm run studio")
  process.exit(manque.length ? 1 : 0)
}
export { readFileSync }
