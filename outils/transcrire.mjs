// Transcription mot à mot du rush (Whisper, sur ton ordinateur, rien n'est envoyé en ligne).
// Usage : node outils/transcrire.mjs <video> [--modele small|medium] [--langue fr] [--pause 0.45] [--seuil -45]
//
// Méthode (testée sur des rushs de 8 min avec beaucoup de reprises) :
//  1. On mesure le son : un « bloc » = un passage parlé, séparé du suivant par un silence d'au moins --pause s.
//     Le seuil de silence est calé sur le volume de ta voix (20 dB sous elle).
//  2. Chaque bloc est transcrit SÉPARÉMENT (modèle chargé une seule fois). Sur un long rush, Whisper décale
//     ses temps de plusieurs secondes s'il écoute tout d'un coup ; bloc par bloc, chaque mot reste à sa place.
// small (466 Mo, rapide) suffit en général ; medium (1,5 Go) est plus précis sur les noms propres.
// Sortie : videos/<video>/transcription.json  { blocs: [{debut, fin, texte}], mots: [{texte, debut, fin, bloc}] }
import { availableParallelism } from "node:os"
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import { basename, join } from "node:path"
import { abs, args, dire, dossierModeles, dossierTravail, dossierVideo, ecrireJson, ffmpeg, hyperframes, lancer, mesurerLufs, sonder, stop, whisperChemin, estPrincipal } from "./lib/commun.mjs"
import { lireMontage } from "./lib/montage.mjs"

const HALLUCINATIONS = /sous-titr|amara\.org|merci d'avoir regard|abonnez-vous|^\s*[♪.…]+\s*$/i
const MARGE = 0.15 // secondes de son gardées autour de chaque bloc pour Whisper

export async function blocsDeParole(wav, seuil, pause, duree) {
  const r = await ffmpeg(["-nostats", "-i", wav, "-af", `silencedetect=noise=${seuil}dB:d=${pause}`, "-f", "null", "-"], { tolerer: true })
  const sil = []
  for (const l of r.erreurs.split("\n")) {
    const a = /silence_start: (-?[\d.]+)/.exec(l); if (a) sil.push([Math.max(0, +a[1]), duree])
    const b = /silence_end: ([\d.]+)/.exec(l); if (b && sil.length) sil.at(-1)[1] = +b[1]
  }
  const blocs = []; let t = 0
  for (const [a, b] of sil) { if (a - t > 0.12) blocs.push([t, a]); t = b }
  if (duree - t > 0.12) blocs.push([t, duree])
  return blocs
}

async function preparerWhisper(modele, langue, essai, travail, journal) {
  const fichier = join(dossierModeles(), `ggml-${modele}.bin`)
  if (existsSync(fichier) && whisperChemin()) return { fichier, cli: whisperChemin() }
  journal("   Première fois : installation de Whisper et téléchargement du modèle (quelques minutes)…")
  const r = await hyperframes(["transcribe", essai, "--engine", "whisper", "--model", modele, "--language", langue, "--json", "-d", travail])
  if (existsSync(fichier) && whisperChemin()) return { fichier, cli: whisperChemin() }
  stop(`Whisper n'est pas prêt. Lance : node outils/installer.mjs\n${(r.erreurs || r.sortie).split("\n").slice(-6).join("\n")}`)
}

export async function transcrire(id, o = {}) {
  const journal = o.journal ?? dire
  const modele = o.modele ?? "small", langue = o.langue ?? "fr", pause = Number(o.pause ?? 0.45)
  const m = lireMontage(id)
  const rush = abs(m.rush)
  if (!existsSync(rush)) stop(`Rush introuvable : ${m.rush}`)
  const travail = dossierTravail(id, m)
  const wav = join(travail, "voix-16k.wav")
  journal("1/3 Extraction du son…")
  await ffmpeg(["-y", "-v", "error", "-i", rush, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav])
  const duree = sonder(wav).duree

  journal("2/3 Repérage des passages parlés…")
  const { lufs } = await mesurerLufs(wav)
  const seuil = o.seuil != null ? Number(o.seuil) : Math.max(-62, Math.min(-30, Math.round((Number.isFinite(lufs) ? lufs : -30) - 20)))
  const blocs = await blocsDeParole(wav, seuil, pause, duree)
  journal(`   voix à ${Number.isFinite(lufs) ? lufs.toFixed(1) : "?"} LUFS, seuil ${seuil} dB : ${blocs.length} passages parlés`)
  if (!blocs.length) stop("Aucune parole détectée. Essaie un seuil plus bas : --seuil -55")
  if (Number.isFinite(lufs) && lufs < -30) journal("   ta voix est très basse dans le rush : monte le gain du micro au prochain tournage (le rendu la remonte quand même).")

  const dir = join(travail, "blocs"); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true })
  const nom = (k) => join(dir, `b${String(k + 1).padStart(3, "0")}.wav`)
  // Whisper entend mal une voix trop basse (il invente des « Merci. ») : on la remonte vers -20 LUFS pour lui
  const gain = Number.isFinite(lufs) ? Math.max(0, Math.min(30, -20 - lufs)) : 0
  const af = gain > 1 ? ["-af", `volume=${gain.toFixed(1)}dB,alimiter=limit=0.9:level=false`] : []
  for (let i = 0; i < blocs.length; i += 40) {
    const sorties = blocs.slice(i, i + 40).flatMap(([a, b], j) => ["-ss", Math.max(0, a - MARGE).toFixed(3), "-t", (b - a + 2 * MARGE).toFixed(3), ...af, nom(i + j)])
    await ffmpeg(["-y", "-v", "error", "-i", wav, ...sorties])
  }

  journal(`3/3 Transcription de chaque passage (modèle ${modele}, langue ${langue})…`)
  const { fichier, cli } = await preparerWhisper(modele, langue, nom(0), travail, journal)
  const fils = String(Math.max(2, Math.min(8, availableParallelism?.() ?? 4)))
  if (process.platform === "win32" && /[^\x00-\x7F]/.test(fichier)) journal("   attention : le chemin du modèle contient des accents, Whisper peut refuser de l'ouvrir sur Windows. Solution : variable HYPERFRAMES_CACHE_DIR=C:\\studio-cache puis node outils/installer.mjs")
  for (let i = 0; i < blocs.length; i += 40) {
    // noms courts lancés depuis le dossier des blocs : évite les soucis de chemins avec espaces ou accents
    const lot = blocs.slice(i, i + 40).flatMap((_, j) => ["-f", basename(nom(i + j))])
    const r = await lancer(cli, ["-m", fichier, "-l", langue, "-ml", "1", "-sow", "-oj", "-np", "-t", fils, ...lot], { cwd: dir })
    if (r.code !== 0) stop(`Whisper a échoué :\n${r.erreurs.split("\n").slice(-8).join("\n")}`)
    journal(`   ${Math.min(blocs.length, i + 40)}/${blocs.length} passages`)
  }

  const mots = [], sortieBlocs = []
  blocs.forEach(([a, b], k) => {
    const j = JSON.parse(readFileSync(nom(k) + ".json", "utf8"))
    const ws = []
    for (const s of j.transcription ?? []) {
      const t = String(s.text ?? "").trim()
      if (!t || /^\[.*\]$/.test(t)) continue
      const debut = Math.max(a, a - MARGE + s.offsets.from / 1000), fin = Math.min(b, a - MARGE + s.offsets.to / 1000)
      if (/^[.,!?…;:»)]+$/.test(t) && ws.length) { ws.at(-1).texte += t; continue }   // ponctuation seule : collée au mot d'avant
      ws.push({ texte: t, debut: +debut.toFixed(3), fin: +Math.max(fin, debut + 0.04).toFixed(3), bloc: k + 1 })
    }
    // bruits notés par Whisper entre crochets ou parenthèses ([Bruit de porte], (rires)) : retirés
    let dedans = false
    for (let i = ws.length - 1; i >= 0; i--) {
      const t = ws[i].texte
      if (/[\])]$/.test(t)) dedans = true
      const ouvre = /^[[(]/.test(t)
      if (dedans) ws.splice(i, 1)
      if (ouvre) dedans = false
    }
    const texte = ws.map((w) => w.texte).join(" ").replace(/\s+([,.!?…])/g, "$1")
    const court = b - a < 0.6 && /^(merci|au revoir|bye)[.!]?$/i.test(texte.trim())   // invention classique de Whisper sur un bruit
    if (!ws.length || HALLUCINATIONS.test(texte) || court) { sortieBlocs.push({ debut: +a.toFixed(3), fin: +b.toFixed(3), texte: "" }); return }
    sortieBlocs.push({ debut: +a.toFixed(3), fin: +b.toFixed(3), texte })
    mots.push(...ws)
  })
  if (!mots.length) stop("Aucun mot reconnu. Le son du rush est-il audible ? Essaie --modele medium.")
  ecrireJson(join(dossierVideo(id), "transcription.json"), { modele, langue, cree: new Date().toISOString(), seuil_db: seuil, lufs_voix: Number.isFinite(lufs) ? +lufs.toFixed(1) : null, pause, blocs: sortieBlocs, mots })
  journal(`${mots.length} mots dans ${sortieBlocs.filter((x) => x.texte).length} passages → videos/${id}/transcription.json`)
  return mots
}

if (estPrincipal(import.meta.url)) {
  const a = args()
  if (!a._[0]) stop("Usage : node outils/transcrire.mjs <video> [--modele small|medium] [--pause 0.45]")
  await transcrire(a._[0], { modele: a.modele, langue: a.langue, pause: a.pause, seuil: a.seuil })
  dire(`Étape suivante : node outils/couper.mjs ${a._[0]}`)
}
