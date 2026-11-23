// Fonctions partagées par tous les outils du studio (Mac et Windows).
// Aucune dépendance en dehors de Node, ffmpeg et HyperFrames (installé dans node_modules par `npm install`).
import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

export const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
export const WIN = process.platform === "win32"
export const MAC = process.platform === "darwin"
export const FPS = 30

export const DOSSIERS = {
  aMonter: join(RACINE, "a-monter"),
  videos: join(RACINE, "videos"),
  finies: join(RACINE, "finies"),
  style: join(RACINE, "mon-style"),
  kit: join(RACINE, "kit"),
  sons: join(RACINE, "sons"),
  outils: join(RACINE, "outils"),
  bin: join(RACINE, "outils", ".bin"),
}

export const EXT_VIDEO = [".mov", ".mp4", ".m4v", ".mkv", ".webm"]

/** Vrai si ce module est le programme lancé (node outils/xxx.mjs), faux s'il est importé par un autre. */
export const estPrincipal = (url) => {
  if (!process.argv[1]) return false
  const n = (p) => (process.platform === "win32" ? p.toLowerCase() : p)   // Windows : « c:\ » et « C:\ » sont le même disque
  return n(resolve(process.argv[1])) === n(fileURLToPath(url))
}

// ---------- Messages ----------
export const dire = (...m) => console.log(...m)
export function stop(message, code = 1) {
  console.error(`\nERREUR : ${message}`)
  process.exit(code)
}

// ---------- JSON ----------
export function lireJson(f, defaut = null) {
  try { return JSON.parse(readFileSync(f, "utf8")) } catch { return defaut }
}
export function ecrireJson(f, v) {
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, JSON.stringify(v, null, 2) + "\n")
}

// ---------- Chemins ----------
/** Chemin relatif à la racine, toujours avec des « / » (pareil sur Mac et Windows). */
export const rel = (p) => relative(RACINE, p).split(sep).join("/")
/** Chemin absolu à partir d'un chemin relatif à la racine (accepte « / » sur Windows). */
export const abs = (p) => (!p ? p : isAbsolute(String(p)) ? String(p) : resolve(RACINE, ...String(p).split("/")))

export function dossierVideo(id) {
  if (!/^[\w.-]+$/.test(id ?? "")) stop(`Identifiant de vidéo invalide : « ${id} ». Regarde les noms dans le dossier videos/.`)
  const d = join(DOSSIERS.videos, id)
  if (!existsSync(d)) stop(`La vidéo « ${id} » n'existe pas dans videos/.`)
  return d
}

export function listerVideos() {
  if (!existsSync(DOSSIERS.videos)) return []
  return readdirSync(DOSSIERS.videos).filter((n) => !n.startsWith(".") && statSync(join(DOSSIERS.videos, n)).isDirectory()).sort().reverse()
}

/** Dossier des fichiers lourds d'une vidéo (plaque, calques, détourage). Par défaut dans la vidéo,
 *  sinon sur un disque externe si `travail` est réglé dans montage.json ou dans la variable STUDIO_TRAVAIL. */
export function dossierTravail(id, montage) {
  const base = process.env.STUDIO_TRAVAIL || montage?.dossier_travail
  const d = base ? join(base, id) : join(DOSSIERS.videos, id, "travail")
  mkdirSync(d, { recursive: true })
  return d
}

// ---------- Programmes externes ----------
function chercherDans(dir, fichier, profondeur = 4) {
  if (!existsSync(dir) || profondeur < 0) return null
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (n.toLowerCase() === fichier.toLowerCase()) return p
    try { if (statSync(p).isDirectory()) { const r = chercherDans(p, fichier, profondeur - 1); if (r) return r } } catch {}
  }
  return null
}
export function trouver(nom) {
  const exe = WIN ? `${nom}.exe` : nom
  const local = chercherDans(DOSSIERS.bin, exe)
  if (local) return local
  const r = spawnSync(WIN ? "where" : "which", [nom], { encoding: "utf8" })
  if (r.status === 0 && r.stdout.trim()) return r.stdout.split(/\r?\n/)[0].trim()
  // Endroits courants absents du PATH (app lancée par double-clic, terminal ouvert avant l'installation)
  const autres = WIN
    ? [join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Links"), join(process.env.USERPROFILE ?? "", "scoop", "shims"), "C:\\ProgramData\\chocolatey\\bin"]
    : ["/opt/homebrew/bin", "/usr/local/bin"]
  for (const p of autres) if (p && existsSync(join(p, exe))) return join(p, exe)
  if (WIN) { const w = chercherDans(join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Packages"), exe, 5); if (w) return w }
  return null
}
export const ffmpegChemin = () => trouver("ffmpeg")
export const ffprobeChemin = () => trouver("ffprobe")
export const whisperChemin = () => process.env.HYPERFRAMES_WHISPER_PATH || trouver("whisper-cli")
/** Dossier des modèles Whisper (le même que HyperFrames, sur Mac comme sur Windows). */
export const dossierModeles = () => join(process.env.HYPERFRAMES_CACHE_DIR || join(homedir(), ".cache", "hyperframes"), "whisper", "models")

/** Lance un programme et attend la fin. Renvoie { code, sortie, erreurs }. */
export function lancer(prog, args, o = {}) {
  return new Promise((ok) => {
    const p = spawn(prog, args, { cwd: o.cwd ?? RACINE, env: { ...process.env, ...(o.env ?? {}) }, windowsHide: true })
    let sortie = "", erreurs = ""
    p.stdout.on("data", (d) => { sortie += d; if (o.afficher) process.stdout.write(d) })
    p.stderr.on("data", (d) => { erreurs += d; if (o.afficher) process.stderr.write(d); o.surErreur?.(String(d)) })
    p.on("error", (e) => ok({ code: -1, sortie, erreurs: erreurs + String(e) }))
    p.on("close", (code) => ok({ code, sortie, erreurs }))
  })
}

export async function ffmpeg(args, o = {}) {
  const f = ffmpegChemin()
  if (!f) stop("ffmpeg est introuvable. Lance d'abord : node outils/installer.mjs")
  const r = await lancer(f, ["-hide_banner", ...args], o)
  if (r.code !== 0 && !o.tolerer) stop(`ffmpeg a échoué :\n${r.erreurs.split("\n").slice(-12).join("\n")}`)
  return r
}

export function sonder(fichier) {
  const f = ffprobeChemin()
  if (!f) stop("ffprobe est introuvable (il vient avec ffmpeg). Lance : node outils/installer.mjs")
  const r = spawnSync(f, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", fichier], { encoding: "utf8" })
  if (r.status !== 0) stop(`Impossible de lire « ${fichier} » : ${r.stderr}`)
  const j = JSON.parse(r.stdout)
  const v = j.streams.find((s) => s.codec_type === "video")
  const a = j.streams.find((s) => s.codec_type === "audio")
  let rotation = 0
  for (const sd of v?.side_data_list ?? []) if (sd.rotation != null) rotation = Number(sd.rotation)
  if (v?.tags?.rotate) rotation = Number(v.tags.rotate)
  let [w, h] = [v?.width ?? 0, v?.height ?? 0]
  if (Math.abs(rotation) % 180 === 90) [w, h] = [h, w]
  const fr = (v?.avg_frame_rate ?? "30/1").split("/").map(Number)
  return {
    duree: Number(j.format.duration ?? 0), largeur: w, hauteur: h, rotation,
    ips: fr[1] ? fr[0] / fr[1] : 30, audio: Boolean(a), video: Boolean(v),
    hdr: ["arib-std-b67", "smpte2084"].includes(v?.color_transfer), transfert: v?.color_transfer ?? null,
  }
}

let _filtres = null
/** Vrai si ffmpeg connaît ce filtre (zscale par exemple, utile pour convertir une vidéo HDR). */
export function filtreDispo(nom) {
  if (!_filtres) {
    const r = spawnSync(ffmpegChemin() ?? "ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" })
    _filtres = r.stdout ?? ""
  }
  return new RegExp(`\\s${nom}\\s`).test(_filtres)
}

/** Volume moyen intégré (LUFS) d'un fichier ou d'un morceau. */
export async function mesurerLufs(fichier, debut = null, duree = null) {
  const a = [...(debut != null ? ["-ss", String(debut)] : []), ...(duree != null ? ["-t", String(duree)] : []), "-i", fichier, "-af", "ebur128=peak=true", "-f", "null", "-"]
  const r = await ffmpeg(["-nostats", ...a], { tolerer: true })
  const bloc = r.erreurs.slice(r.erreurs.lastIndexOf("Summary:"))
  const I = Number(/I:\s+(-?[\d.]+) LUFS/.exec(bloc)?.[1] ?? NaN)
  const crete = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(bloc)?.[1] ?? NaN)
  return { lufs: I, crete }
}

// ---------- HyperFrames (installé localement) ----------
export function hyperframesChemin() {
  const p = join(RACINE, "node_modules", "hyperframes", "bin", "hyperframes.mjs")
  return existsSync(p) ? p : null
}
export async function hyperframes(args, o = {}) {
  const p = hyperframesChemin()
  if (!p) stop("HyperFrames n'est pas installé. Lance : npm install (à la racine du studio).")
  const env = {}
  const whisper = chercherDans(DOSSIERS.bin, WIN ? "whisper-cli.exe" : "whisper-cli")
  if (whisper) env.HYPERFRAMES_WHISPER_PATH = whisper
  return lancer(process.execPath, [p, ...args], { ...o, env: { ...env, ...(o.env ?? {}) } })
}

// ---------- Temps ----------
export const arrondiImage = (t) => Math.round(t * FPS) / FPS
export const s2 = (t) => Number(t).toFixed(2)
export function hms(t) {
  const m = Math.floor(t / 60), s = t - m * 60
  return `${m}:${s.toFixed(1).padStart(4, "0")}`
}

// ---------- Arguments en ligne de commande ----------
/** `--cle valeur` et `--drapeau` → objet ; le reste dans `_`. */
export function args(argv = process.argv.slice(2)) {
  const o = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--")) {
      const k = a.slice(2)
      if (argv[i + 1] != null && !argv[i + 1].startsWith("--")) o[k] = argv[++i]
      else o[k] = true
    } else o._.push(a)
  }
  return o
}

export { existsSync, join, mkdirSync, readFileSync, writeFileSync }

let _decodeurs = null
/** Vrai si ffmpeg a ce décodeur (libvpx-vp9 pour lire la transparence des WebM du détourage). */
export function decodeurDispo(nom) {
  if (!_decodeurs) _decodeurs = spawnSync(ffmpegChemin() ?? "ffmpeg", ["-hide_banner", "-decoders"], { encoding: "utf8" }).stdout ?? ""
  return new RegExp(`\\s${nom}\\s`).test(_decodeurs)
}
