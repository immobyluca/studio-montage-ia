// Rendu de la vidéo : coupes + zooms (plaque), voix + bruitages (-14 LUFS), calques (accroche, sous-titres,
// animations), détourage si demandé, puis assemblage en MP4 1080x1920 (ou 1920x1080), 30 i/s.
// Usage : node outils/rendre.mjs <video> [--apercu]
//   --apercu : petite taille (540x960), rapide, dans videos/<video>/apercu.mp4. Sans : rendu final dans
//   videos/<video>/export/ et une copie dans finies/.
// Les fichiers lourds vont dans videos/<video>/travail/ (ou STUDIO_TRAVAIL=/chemin/disque-externe).
import { createHash } from "node:crypto"
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { DOSSIERS, FPS, MAC, abs, args, dire, dossierTravail, dossierVideo, ecrireJson, ffmpeg, filtreDispo, hms, hyperframes, lireJson, mesurerLufs, rel, sonder, stop, estPrincipal } from "./lib/commun.mjs"
import { dimensions, lireMontage, morceaux } from "./lib/montage.mjs"
import { preparerCalques } from "./calques.mjs"

const cle = (o) => createHash("sha1").update(JSON.stringify(o)).digest("hex").slice(0, 12)
const chemin = (p) => p.replace(/\\/g, "/").replace(/'/g, "'\\''")

/** Expression du zoom d'accroche : 100 % → 112 % en 0,45 s (amplifie l'élan), puis poussée lente jusqu'à 116 %. */
const zoomAccroche = (d) => `if(lt(t,0.45),1+0.12*(1-pow(1-t/0.45,3)),1.12+0.04*min(1,(t-0.45)/${Math.max(0.1, d - 0.45).toFixed(3)}))`

async function encoderMorceaux(m, pieces, info, L, H, apercu, dir, journal) {
  mkdirSync(dir, { recursive: true })
  const rush = abs(m.rush)
  const [ax, ay] = m.zooms?.ancre ?? [0.5, 0.3]
  const hdr = info.hdr && filtreDispo("zscale")
  if (info.hdr && !hdr) journal("  attention : rush HDR et ffmpeg sans « zscale » : les couleurs peuvent paraître délavées. Installe un ffmpeg complet (voir node outils/installer.mjs).")
  const dyn = m.zooms?.accroche && m.zooms?.actif !== false
  const c = Math.max(L / info.largeur, H / info.hauteur)
  const fichiers = []
  let faits = 0
  for (const [i, x] of pieces.entries()) {
    const n = Math.round((x.tl[1] - x.tl[0]) * FPS)
    const k = cle({ rush, src: x.src, z: x.zoom, dyn: dyn && i === 0, L, H, ax, ay, hdr, apercu, n, v: 3 })
    const fv = join(dir, `${k}.mp4`), fa = join(dir, `${k}.wav`)
    fichiers.push([fv, fa])
    if (existsSync(fv) && existsSync(fa)) continue
    let geo
    if (dyn && i === 0) {
      const Z = zoomAccroche(n / FPS)
      geo = `scale=w='2*trunc(${(info.largeur * c).toFixed(2)}*(${Z})/2)':h='2*trunc(${(info.hauteur * c).toFixed(2)}*(${Z})/2)':eval=frame:flags=bicubic,crop=${L}:${H}:x='(iw-${L})*${ax}':y='(ih-${H})*${ay}'`
    } else {
      const sw = 2 * Math.ceil((info.largeur * c * x.zoom) / 2), sh = 2 * Math.ceil((info.hauteur * c * x.zoom) / 2)
      geo = `scale=${sw}:${sh}:flags=lanczos,crop=${L}:${H}:${Math.round((sw - L) * ax)}:${Math.round((sh - H) * ay)}`
    }
    const couleur = hdr ? "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p" : "format=yuv420p"
    const vf = `fps=${FPS},${geo},${couleur},setsar=1,tpad=stop_mode=clone:stop=3,trim=end_frame=${n},setpts=PTS-STARTPTS`
    const ns = n * 1600 // échantillons à 48 kHz pour n images à 30 i/s
    const af = `aresample=48000,aformat=channel_layouts=stereo,atrim=end_sample=${ns},apad=whole_len=${ns},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=${(n / FPS - 0.012).toFixed(3)}:d=0.012`
    await ffmpeg(["-y", "-v", "error", ...(MAC ? ["-hwaccel", "videotoolbox"] : []), "-ss", String(x.src[0]), "-t", String((n / FPS + 0.2).toFixed(3)), "-i", rush,
      "-filter_complex", `[0:v]${vf}[v];[0:a]${af}[a]`,
      "-map", "[v]", "-c:v", "libx264", "-preset", apercu ? "veryfast" : "medium", "-crf", apercu ? "23" : "14", "-pix_fmt", "yuv420p",
      "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-r", String(FPS), "-an", fv,
      "-map", "[a]", "-c:a", "pcm_s16le", "-vn", fa])
    faits++
    if (faits % 5 === 0) journal(`   ${i + 1}/${pieces.length} morceaux`)
  }
  journal(`   ${pieces.length} morceaux (${faits} encodés, ${pieces.length - faits} déjà prêts)`)
  return fichiers
}

async function recoller(liste, sortie, dir) {
  const f = join(dir, `liste-${Date.now()}.txt`)
  writeFileSync(f, liste.map((p) => `file '${chemin(p)}'`).join("\n"))
  await ffmpeg(["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", f, "-c", "copy", sortie])
  rmSync(f, { force: true })
}

async function mixer(voix, sons, musique, duree, cible, sortie, journal) {
  // un son tous les 0,35 s au plus (le plus important gagne)
  const ev = []
  for (const s of [...sons].sort((a, b) => a.t - b.t)) {
    if (!s.fichier || !existsSync(abs(s.fichier))) { if (s.fichier) journal(`  attention : son introuvable ${s.fichier}`); continue }
    const d = ev.at(-1)
    if (d && s.t - d.t < 0.35) { if ((s.prio ?? 1) > (d.prio ?? 1)) ev[ev.length - 1] = s; continue }
    ev.push(s)
  }
  const ins = ["-i", voix], fc = ["[0:a]aformat=channel_layouts=stereo[v0]"], noms = ["[v0]"]
  ev.forEach((s, i) => {
    ins.push("-i", abs(s.fichier)); const ms = Math.max(0, Math.round(s.t * 1000))
    fc.push(`[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${s.volume ?? -18}dB,adelay=${ms}|${ms}[s${i}]`); noms.push(`[s${i}]`)
  })
  if (musique?.fichier && existsSync(abs(musique.fichier))) {
    const k = ev.length + 1
    ins.push("-stream_loop", "-1", "-i", abs(musique.fichier))
    fc.push(`[${k}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:${duree},volume=${musique.volume ?? -26}dB,afade=t=in:d=1,afade=t=out:st=${Math.max(0, duree - 1.5)}:d=1.5[mu]`); noms.push("[mu]")
  }
  fc.push(`${noms.join("")}amix=inputs=${noms.length}:normalize=0:duration=first[m]`)
  const brut = sortie.replace(/\.wav$/, "-brut.wav")
  await ffmpeg(["-y", "-v", "error", ...ins, "-filter_complex", fc.join(";"), "-map", "[m]", "-ar", "48000", "-c:a", "pcm_f32le", brut])
  const { lufs } = await mesurerLufs(brut)
  const gain = Number.isFinite(lufs) ? cible - lufs : 0
  await ffmpeg(["-y", "-v", "error", "-i", brut, "-af", `volume=${gain.toFixed(2)}dB,alimiter=limit=0.84:attack=5:release=80:level=false`, "-ar", "48000", "-c:a", "pcm_s16le", sortie])
  rmSync(brut, { force: true })
  journal(`   ${ev.length} bruitages, voix à ${Number.isFinite(lufs) ? lufs.toFixed(1) : "?"} LUFS, remontée de ${gain.toFixed(1)} dB vers ${cible} LUFS`)
}

function matte(fenetres, duree, f) {
  const N = Math.round(duree * FPS), b = Buffer.alloc(N * 4)
  const rampe = (t, t0, t1) => (t < t0 - 0.1 || t > t1 + 0.05 ? 0 : Math.max(0, Math.min(1, (t - (t0 - 0.1)) / 0.4, (t1 + 0.05 - t) / 0.35)))
  for (let n = 0; n < N; n++) { const v = Math.round(255 * Math.max(0, ...fenetres.map(([a, z]) => rampe(n / FPS, a, z)))); b.fill(v, n * 4, n * 4 + 4) }
  writeFileSync(f, b)
}

async function rendreCalque(dir, sortie, apercu, journal) {
  const empreinte = cle({ html: readFileSync(join(dir, "index.html"), "utf8"), css: readFileSync(join(dir, "assets", "style.css"), "utf8"), kit: readFileSync(join(dir, "assets", "kit.js"), "utf8"), apercu })
  const meta = sortie + ".json"
  if (existsSync(sortie) && lireJson(meta)?.empreinte === empreinte) { journal("   calque inchangé, réutilisé"); return }
  const t0 = Date.now()
  const r = await hyperframes(["render", dir, "--format", "mov", "-o", sortie, "--fps", apercu ? "15" : String(FPS), "--quality", apercu ? "draft" : "delivery", "--quiet"])
  if (r.code !== 0 || !existsSync(sortie)) stop(`Le rendu du calque a échoué :\n${(r.erreurs || r.sortie).split("\n").slice(-15).join("\n")}\nPiste : node node_modules/hyperframes/bin/hyperframes.mjs doctor`)
  ecrireJson(meta, { empreinte })
  journal(`   calque rendu en ${Math.round((Date.now() - t0) / 1000)} s`)
}

/** Étape 1 seule : la vidéo coupée et zoomée (plaque) et la voix coupée. Sert aussi au détourage. */
export async function fabriquerPlaque(id, o = {}) {
  const journal = o.journal ?? dire
  const apercu = Boolean(o.apercu)
  const m = lireMontage(id)
  const rush = abs(m.rush)
  if (!existsSync(rush)) stop(`Rush introuvable : ${m.rush} (disque externe débranché ?)`)
  const info = sonder(rush)
  const pieces = morceaux(m)
  if (!pieces.length) stop("Aucune prise gardée. Lance node outils/couper.mjs ou coche des prises dans le dashboard.")
  const [L0, H0] = dimensions(m.format)
  const [L, H] = apercu ? [L0 / 2, H0 / 2] : [L0, H0]
  const travail = dossierTravail(id, m)
  const f = await encoderMorceaux(m, pieces, info, L, H, apercu, join(travail, apercu ? "morceaux-apercu" : "morceaux"), journal)
  const plaque = join(travail, apercu ? "plaque-apercu.mp4" : "plaque.mp4"), voix = join(travail, "voix.wav")
  await recoller(f.map((x) => x[0]), plaque, travail)
  await recoller(f.map((x) => x[1]), voix, travail)
  const clePlaque = cle({ p: pieces.map((x) => [x.src, x.zoom]), dyn: Boolean(m.zooms?.accroche) })
  return { m, pieces, duree: pieces.at(-1).tl[1], L, H, L0, H0, travail, plaque, voix, clePlaque }
}

export async function rendre(id, o = {}) {
  const journal = o.journal ?? dire
  const apercu = Boolean(o.apercu)
  const t0 = Date.now()
  const m0 = lireMontage(id)
  journal(`${apercu ? "Aperçu" : "Rendu final"} de « ${m0.titre || id} »`)
  journal("1/5 Coupes et zooms…")
  const { m, pieces, duree, L, H, L0, travail, plaque, voix, clePlaque } = await fabriquerPlaque(id, { apercu, journal })
  journal(`   ${pieces.length} morceaux, ${hms(duree)}, ${L}x${H}`)

  journal("2/5 Calques (accroche, sous-titres, animations)…")
  let detourage = Boolean(m.detourage)
  const sujet = join(travail, "sujet.webm")
  if (detourage && (!existsSync(sujet) || lireJson(sujet + ".json")?.plaque !== clePlaque)) {
    journal(existsSync(sujet) ? "   le détourage date d'avant tes dernières coupes : relance node outils/detourer.mjs" : "   détourage demandé mais pas encore fait : node outils/detourer.mjs " + id)
    detourage = false
  }
  const plan = preparerCalques(id, { journal: (t) => journal("   " + t.trim()), detourageDispo: detourage })
  const calques = {}
  for (const [c, dir] of Object.entries(plan.couches)) {
    calques[c] = join(travail, `calque-${c}${apercu ? "-apercu" : ""}.mov`)
    journal(`   rendu du calque « ${c} » (le plus long, HyperFrames dessine chaque image)…`)
    await rendreCalque(dir, calques[c], apercu, journal)
  }

  journal("3/5 Son (voix, bruitages, musique)…")
  const mix = join(travail, "mix.wav")
  await mixer(voix, plan.sons, m.musique, duree, m.rendu?.lufs ?? -14, mix, journal)

  journal("4/5 Assemblage…")
  const ins = ["-i", plaque], fc = ["[0:v]format=gbrp[p0]"]
  let p = "p0", k = 1
  // un WebM transparent (détourage) doit être lu par libvpx, sinon ffmpeg perd la transparence
  const entree = (fichier) => { if (fichier.endsWith(".webm")) ins.push("-c:v", "libvpx-vp9"); ins.push("-i", fichier); return k++ }
  const flouter = (fenetres, nom, sigma) => {
    if (!fenetres.length) return
    const fm = join(travail, `matte-${nom}.raw`); matte(fenetres, duree, fm)
    ins.push("-f", "rawvideo", "-pix_fmt", "gray", "-s", "2x2", "-r", String(FPS), "-i", fm); const j = k++
    fc.push(`[${j}:v]scale=${L}:${H}:flags=neighbor,format=gbrp[m${nom}]`, `[${p}]split[${p}a][${p}b]`, `[${p}b]gblur=sigma=${sigma * (L / L0)}[${p}f]`, `[${p}a][${p}f][m${nom}]maskedmerge[${p}${nom}]`)
    p = `${p}${nom}`
  }
  const poser = (fichier, nom) => { const j = entree(fichier); fc.push(`[${j}:v]scale=${L}:${H},format=gbrap[${nom}]`, `[${p}][${nom}]overlay=format=gbrp:eof_action=pass[${p}${nom}]`); p = `${p}${nom}` }
  flouter(plan.flou.derriere, "b", 26)
  if (calques.arriere) poser(calques.arriere, "arr")
  if (detourage) poser(sujet, "suj")
  flouter(plan.flou.plein, "q", 30)
  if (calques.avant) poser(calques.avant, "av")
  fc.push(`[${p}]format=yuv420p[v]`)
  const ia = entree(mix)
  let sortie
  if (apercu) sortie = join(dossierVideo(id), "apercu.mp4")
  else {
    const d = join(dossierVideo(id), "export"); mkdirSync(d, { recursive: true })
    let n = 1; sortie = join(d, `${id}.mp4`)
    while (existsSync(sortie)) sortie = join(d, `${id}_v${++n}.mp4`)
  }
  await ffmpeg(["-y", "-v", "error", ...ins, "-filter_complex", fc.join(";"), "-map", "[v]", "-map", `${ia}:a`,
    "-c:v", "libx264", "-preset", apercu ? "veryfast" : "medium", "-crf", apercu ? "26" : "17", "-profile:v", "high", "-pix_fmt", "yuv420p",
    "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k", "-t", duree.toFixed(3), "-movflags", "+faststart", sortie])

  journal("5/5 Contrôles…")
  const fin = sonder(sortie), son = await mesurerLufs(sortie)
  const controles = {
    duree: { attendu: +duree.toFixed(2), obtenu: +fin.duree.toFixed(2), ok: Math.abs(fin.duree - duree) < 0.15 },
    image: { obtenu: `${fin.largeur}x${fin.hauteur}`, ok: fin.largeur === L && fin.hauteur === H },
    volume: { lufs: son.lufs, crete: son.crete, ok: Math.abs(son.lufs - (m.rendu?.lufs ?? -14)) < 1.5 && son.crete <= -0.5 },
  }
  const rapport = { fichier: rel(sortie), apercu, date: new Date().toISOString(), duree_rendu_s: Math.round((Date.now() - t0) / 1000), controles, ok: Object.values(controles).every((c) => c.ok) }
  ecrireJson(join(dossierVideo(id), apercu ? "apercu.json" : "rendu.json"), rapport)
  if (!apercu) { mkdirSync(DOSSIERS.finies, { recursive: true }); copyFileSync(sortie, join(DOSSIERS.finies, sortie.split(/[\\/]/).pop())) }
  journal(`\n${rapport.ok ? "OK" : "À VÉRIFIER"} : ${rel(sortie)} (${hms(fin.duree)}, ${fin.largeur}x${fin.hauteur}, ${son.lufs} LUFS, crête ${son.crete} dBFS, ${Math.round(statSync(sortie).size / 1e6)} Mo, rendu en ${rapport.duree_rendu_s} s)`)
  if (!apercu) journal(`Copie rangée dans finies/. Rien n'est publié.`)
  return rapport
}

if (estPrincipal(import.meta.url)) {
  const a = args()
  if (!a._[0]) stop("Usage : node outils/rendre.mjs <video> [--apercu]")
  await rendre(a._[0], { apercu: Boolean(a.apercu) })
}
export { readdirSync }
