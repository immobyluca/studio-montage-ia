// Serveur local du dashboard. Écoute seulement sur ton ordinateur (127.0.0.1), aucune dépendance.
// Lancement : npm run studio   (ou double-clic sur « Ouvrir le studio »)
// Le dashboard et ton IA travaillent sur les mêmes fichiers (videos/<video>/montage.json) :
// ce que l'un change, l'autre le voit.
import { spawn } from "node:child_process"
import { appendFileSync, createReadStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { basename, dirname, extname, join, normalize, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { DOSSIERS, EXT_VIDEO, RACINE, abs, dossierTravail, lireJson, listerVideos, rel } from "../outils/lib/commun.mjs"
import { dureeMontage, morceaux } from "../outils/lib/montage.mjs"
import { creerVideo } from "../outils/nouvelle-video.mjs"
import { verifier } from "../outils/verifier.mjs"

const PORT = Number(process.env.PORT ?? 4320)
const HOTE = "127.0.0.1"
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "public")
const LISIBLES = ["videos", "a-monter", "sons", "kit", "mon-style", "finies"]
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4", ".mov": "video/quicktime", ".m4v": "video/mp4", ".webm": "video/webm", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".svg": "image/svg+xml", ".md": "text/markdown; charset=utf-8", ".ttf": "font/ttf", ".woff2": "font/woff2" }

// ---------- Travaux (un seul à la fois : la machine est déjà bien occupée) ----------
const ACTIONS = {
  transcrire: (id) => ["outils/transcrire.mjs", id],
  couper: (id) => ["outils/couper.mjs", id],
  apercu: (id) => ["outils/rendre.mjs", id, "--apercu"],
  rendu: (id) => ["outils/rendre.mjs", id],
  detourer: (id) => ["outils/detourer.mjs", id],
  images: (id) => ["outils/images.mjs", id],
  galerie: () => ["outils/galerie.mjs"],
}
let travail = null
function lancerTravail(action, id) {
  if (travail?.en_cours) throw new Error(`Un travail est déjà en cours (${travail.action}). Attends qu'il finisse.`)
  const argv = ACTIONS[action]?.(id)
  if (!argv) throw new Error("Action inconnue")
  travail = { action, video: id ?? null, en_cours: true, debut: Date.now(), lignes: [], code: null }
  const t = travail
  const p = spawn(process.execPath, argv, { cwd: RACINE, env: process.env, windowsHide: true })
  const recevoir = (d) => { for (const l of String(d).split(/\r?\n/)) if (l.trim()) t.lignes.push(l); if (t.lignes.length > 400) t.lignes.splice(0, t.lignes.length - 400) }
  p.stdout.on("data", recevoir); p.stderr.on("data", recevoir)
  p.on("close", (code) => {
    t.en_cours = false; t.code = code; t.fin = Date.now()
    if (id) try { appendFileSync(join(DOSSIERS.videos, id, "journal.txt"), `\n## ${new Date().toISOString()} ${action} (code ${code})\n${t.lignes.join("\n")}\n`) } catch {}
  })
}

// ---------- Vidéos ----------
function resumeVideo(id) {
  const d = join(DOSSIERS.videos, id)
  const m = lireJson(join(d, "montage.json")) ?? {}
  let duree = 0
  try { duree = dureeMontage({ ...m, prises: m.prises ?? [] }) } catch {}
  return {
    id, titre: m.titre || id, format: m.format ?? "9:16", duree: +duree.toFixed(1),
    etat: { transcription: existsSync(join(d, "transcription.json")), coupes: (m.prises ?? []).length > 0, apercu: existsSync(join(d, "apercu.mp4")), rendu: existsSync(join(d, "rendu.json")) },
  }
}
function lireVideo(id) {
  if (!/^[\w.-]+$/.test(id) || !existsSync(join(DOSSIERS.videos, id, "montage.json"))) throw new Error("Vidéo introuvable")
  const d = join(DOSSIERS.videos, id)
  const m = lireJson(join(d, "montage.json"))
  if (!m) throw new Error("montage.json est illisible (une virgule en trop ?). Demande à ton IA de le réparer.")
  const tr = lireJson(join(d, "transcription.json"))
  const date = (f) => (existsSync(f) ? statSync(f).mtimeMs : 0)
  let pieces = []
  try { pieces = morceaux({ ...m, prises: m.prises ?? [] }) } catch {}
  return {
    montage: m, version: date(join(d, "montage.json")),
    transcription: tr ? { mots: tr.mots?.length ?? 0, blocs: tr.blocs?.length ?? 0, modele: tr.modele } : null,
    mots_montage: lireJson(join(d, "mots-montage.json"))?.mots ?? null,
    duree: +(pieces.at(-1)?.tl[1] ?? 0).toFixed(2), pieces: pieces.map((x) => ({ prise: x.prise, src: x.src, tl: x.tl })),
    apercu: existsSync(join(d, "apercu.mp4")) ? `/fichiers/videos/${id}/apercu.mp4?v=${date(join(d, "apercu.mp4"))}` : null,
    apercu_controles: lireJson(join(d, "apercu.json")), rendu: lireJson(join(d, "rendu.json")),
    planche: existsSync(join(d, "planche.jpg")) ? `/fichiers/videos/${id}/planche.jpg?v=${date(join(d, "planche.jpg"))}` : null,
    demandes: existsSync(join(d, "demandes.md")) ? readFileSync(join(d, "demandes.md"), "utf8") : "",
    rush: `/api/videos/${id}/rush`, rush_present: existsSync(abs(m.rush ?? "")),
    detourage_pret: (() => { try { return existsSync(join(dossierTravail(id, m), "sujet.webm")) } catch { return false } })(),
  }
}
function rushsLibres() {
  if (!existsSync(DOSSIERS.aMonter)) return []
  const pris = new Set(listerVideos().map((id) => lireJson(join(DOSSIERS.videos, id, "montage.json"))?.rush))
  return readdirSync(DOSSIERS.aMonter).filter((f) => EXT_VIDEO.includes(extname(f).toLowerCase()) && !pris.has(`a-monter/${f}`))
}

// ---------- HTTP ----------
function json(res, code, v) { res.writeHead(code, { "Content-Type": TYPES[".json"], "Cache-Control": "no-store" }); res.end(JSON.stringify(v)) }
async function corps(req) {
  let s = ""; for await (const c of req) { s += c; if (s.length > 2e6) throw new Error("Trop gros") }
  return s ? JSON.parse(s) : {}
}
function servirFichier(req, res, f) {
  if (!existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); res.end("Introuvable"); return }
  const taille = statSync(f).size, type = TYPES[extname(f).toLowerCase()] ?? "application/octet-stream"
  const plage = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "")
  if (plage) {
    const debut = plage[1] ? Number(plage[1]) : 0, fin = plage[2] ? Math.min(Number(plage[2]), taille - 1) : taille - 1
    if (debut >= taille) { res.writeHead(416, { "Content-Range": `bytes */${taille}` }); res.end(); return }
    res.writeHead(206, { "Content-Type": type, "Content-Range": `bytes ${debut}-${fin}/${taille}`, "Accept-Ranges": "bytes", "Content-Length": fin - debut + 1, "Cache-Control": "no-store" })
    createReadStream(f, { start: debut, end: fin }).pipe(res)
  } else {
    res.writeHead(200, { "Content-Type": type, "Content-Length": taille, "Accept-Ranges": "bytes", "Cache-Control": "no-store" })
    createReadStream(f).pipe(res)
  }
}
const dans = (p, base) => { const r = resolve(p); return r === base || r.startsWith(base + sep) }

const routes = [
  ["GET", /^\/api\/etat$/, () => ({ outils: verifier(), videos: listerVideos().map(resumeVideo), rushs_libres: rushsLibres(), travail: travail && { ...travail, lignes: undefined } })],
  ["GET", /^\/api\/travail$/, () => travail ?? { en_cours: false, lignes: [] }],
  ["POST", /^\/api\/videos$/, (_m, b) => { const { id } = creerVideo(String(b.rush ?? ""), { sujet: b.sujet ? String(b.sujet) : undefined, format: b.format }); return { id } }],
  ["GET", /^\/api\/videos\/([\w.-]+)$/, ([, id]) => lireVideo(id)],
  ["PUT", /^\/api\/videos\/([\w.-]+)\/montage$/, ([, id], b) => {
    const f = join(DOSSIERS.videos, id, "montage.json")
    if (!existsSync(f)) throw new Error("Vidéo introuvable")
    if (!b || typeof b !== "object" || !Array.isArray(b.prises)) throw new Error("Montage invalide")
    if (b.version && statSync(f).mtimeMs > b.version + 1) throw new Error("Ton IA vient de modifier ce montage. Recharge avant d'enregistrer (rien n'a été écrasé).")
    const { version, ...m } = b
    writeFileSync(f, JSON.stringify(m, null, 2) + "\n")
    return { ok: true, version: statSync(f).mtimeMs }
  }],
  ["POST", /^\/api\/videos\/([\w.-]+)\/action$/, ([, id], b) => { lancerTravail(String(b.action), id); return { ok: true } }],
  ["POST", /^\/api\/galerie$/, () => { lancerTravail("galerie"); return { ok: true } }],
  ["POST", /^\/api\/videos\/([\w.-]+)\/demande$/, ([, id], b) => {
    const texte = String(b.texte ?? "").trim().slice(0, 3000)
    if (!texte) throw new Error("Écris ta demande")
    const f = join(DOSSIERS.videos, id, "demandes.md")
    appendFileSync(f, `\n- [ ] ${new Date().toLocaleString("fr-FR")} : ${texte.replace(/\n+/g, " / ")}\n`)
    return { prompt: `Dans mon studio de montage, lis videos/${id}/demandes.md : il y a une nouvelle demande (case non cochée). Applique-la au montage (videos/${id}/montage.json), relance l'aperçu, coche la demande et dis-moi ce que tu as changé.` }
  }],
  ["GET", /^\/api\/kit$/, () => lireJson(join(DOSSIERS.kit, "animations.json"))],
  ["GET", /^\/api\/sons$/, () => readdirSync(DOSSIERS.sons).filter((f) => /\.(wav|mp3)$/i.test(f)).sort().map((f) => ({ fichier: `sons/${f}`, url: `/fichiers/sons/${encodeURIComponent(f)}`, nom: basename(f, extname(f)).replace(/[_-]+/g, " ") }))],
  ["GET", /^\/api\/style$/, () => ({ charte: lireJson(join(DOSSIERS.style, "charte.json")), galerie: existsSync(join(DOSSIERS.style, "galerie.mp4")) ? `/fichiers/mon-style/galerie.mp4?v=${statSync(join(DOSSIERS.style, "galerie.mp4")).mtimeMs}` : null })],
  ["PUT", /^\/api\/style$/, (_m, b) => {
    if (!b?.couleurs || !b?.polices) throw new Error("Charte invalide")
    writeFileSync(join(DOSSIERS.style, "charte.json"), JSON.stringify(b, null, 2) + "\n"); return { ok: true }
  }],
]

const serveur = createServer(async (req, res) => {
  try {
    // Seules les pages du dashboard lui-même peuvent lui parler (pas un autre site ouvert dans ton navigateur)
    if (!new RegExp(`^(127\\.0\\.0\\.1|localhost):${PORT}$`).test(req.headers.host ?? "")) { res.writeHead(403); res.end("Hôte refusé"); return }
    const origine = req.headers.origin
    if (req.method !== "GET" && origine && !new RegExp(`^http://(127\\.0\\.0\\.1|localhost):${PORT}$`).test(origine)) { res.writeHead(403); res.end("Origine refusée"); return }
    const url = new URL(req.url, `http://${HOTE}:${PORT}`)
    const chemin = decodeURIComponent(url.pathname)

    const rush = /^\/api\/videos\/([\w.-]+)\/rush$/.exec(chemin)
    if (rush && req.method === "GET") { const m = lireJson(join(DOSSIERS.videos, rush[1], "montage.json")); return servirFichier(req, res, abs(m?.rush ?? "")) }

    for (const [meth, re, f] of routes) {
      const r = re.exec(chemin)
      if (r && req.method === meth) {
        try { return json(res, 200, await f(r, meth === "GET" ? null : await corps(req))) } catch (e) { return json(res, 400, { erreur: e.message }) }
      }
    }
    if (chemin.startsWith("/fichiers/")) {
      const relatif = normalize(chemin.slice("/fichiers/".length))
      const f = resolve(RACINE, relatif)
      if (!LISIBLES.some((d) => dans(f, join(RACINE, d))) || basename(f).startsWith(".")) { res.writeHead(403); res.end("Interdit"); return }
      return servirFichier(req, res, f)
    }
    const f = resolve(PUBLIC, "." + (chemin === "/" ? "/index.html" : chemin))
    if (!dans(f, PUBLIC)) { res.writeHead(403); res.end(); return }
    return servirFichier(req, res, existsSync(f) ? f : join(PUBLIC, "index.html"))
  } catch (e) { res.writeHead(500); res.end(String(e.message)) }
})

serveur.on("error", (e) => {
  if (e.code === "EADDRINUSE") console.log(`Le dashboard tourne déjà : ouvre http://${HOTE}:${PORT}`)
  else console.error(e)
  process.exit(0)
})
serveur.listen(PORT, HOTE, () => {
  console.log(`Dashboard prêt : http://${HOTE}:${PORT}  (pour l'arrêter : Ctrl+C ou ferme cette fenêtre)`)
  if (process.argv.includes("--ouvrir")) {
    const cmd = process.platform === "darwin" ? ["open", [`http://${HOTE}:${PORT}`]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", `http://${HOTE}:${PORT}`]] : ["xdg-open", [`http://${HOTE}:${PORT}`]]
    spawn(cmd[0], cmd[1], { stdio: "ignore", detached: true }).unref()
  }
})
export { rel }
