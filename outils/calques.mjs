// Fabrique les calques HyperFrames d'une vidéo (titre d'accroche, sous-titres, animations) à partir de
// montage.json, de la transcription et de ta charte (mon-style/charte.json).
// Usage : node outils/calques.mjs <video>      (rendre.mjs l'appelle tout seul)
// Sortie : <travail>/calques/avant/ (et arriere/ si détourage), plus <travail>/calques/plan.json
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { basename, extname, join } from "node:path"
import { DOSSIERS, RACINE, abs, args, dire, dossierTravail, dossierVideo, ecrireJson, lireJson, rel, stop, estPrincipal } from "./lib/commun.mjs"
import { dimensions, dureeMontage, lireMontage, lireTranscription, motsFrise, resoudreTemps } from "./lib/montage.mjs"

const CLES_TEMPS = ["t", "au", "deflou", "t_accent", "t_oui", "t_non", "t_barre", "t_vrai"]

export function lireCharte() {
  const c = lireJson(join(DOSSIERS.style, "charte.json"))
  if (!c) stop("mon-style/charte.json est absent ou illisible (vérifie les virgules et les guillemets).")
  return c
}

function hexVersRgba(hex, a) {
  const h = String(hex).replace("#", "")
  if (!/^[0-9a-f]{6}$/i.test(h)) return hex
  const n = parseInt(h, 16)
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** Copie les polices, le logo et les fichiers du kit dans le dossier assets d'un calque, et écrit style.css. */
export function preparerAssets(dir, charte) {
  const as = join(dir, "assets")
  mkdirSync(join(as, "polices"), { recursive: true })
  for (const f of ["gsap.min.js", "moteur.js", "base.css"]) copyFileSync(join(DOSSIERS.kit, "commun", f), join(as, f))
  copyFileSync(join(DOSSIERS.kit, "kit.js"), join(as, "kit.js"))
  const C = charte.couleurs ?? {}, P = charte.polices ?? {}
  let css = "/* Écrit par outils/calques.mjs depuis mon-style/charte.json */\n"
  for (const [role, nom] of [["titres", "Titres"], ["texte", "Texte"], ["accent", "Accent"]]) {
    const p = P[role] ?? P.titres ?? {}
    const src = p.fichier ? abs(p.fichier) : join(DOSSIERS.kit, "commun", "polices", "Inter-Variable.ttf")
    if (!existsSync(src)) stop(`Police introuvable : ${p.fichier} (mon-style/charte.json → polices.${role}.fichier)`)
    const dest = `${role}${extname(src)}`
    copyFileSync(src, join(as, "polices", dest))
    css += `@font-face { font-family: "${nom}"; src: url("polices/${dest}"); font-weight: 100 1000; font-style: ${p.italique ? "italic" : "normal"}; }\n`
  }
  const op = C.opacite_surface ?? 0.92
  const st = charte.sous_titres ?? {}, ac = charte.accroche ?? {}
  css += `:root {
  --surface: ${hexVersRgba(C.surface ?? "#111111", op)}; --texte: ${C.texte ?? "#FFFFFF"}; --texte-inactif: ${hexVersRgba(C.texte ?? "#FFFFFF", st.opacite_inactif ?? 0.55)};
  --accent: ${C.accent ?? "#FFFFFF"}; --texte-accent: ${C.texte_accent ?? "#111111"};
  --clair: ${C.clair ?? "#FFFFFF"}; --texte-clair: ${C.texte_clair ?? "#111111"};
  --attention: ${C.attention ?? "#FFFFFF"}; --texte-attention: ${C.texte_attention ?? "#111111"};
  --surface-eteinte: ${hexVersRgba(C.texte ?? "#FFFFFF", 0.14)}; --texte-eteint: ${hexVersRgba(C.texte ?? "#FFFFFF", 0.6)};
  --voile: ${C.voile ?? "rgba(0,0,0,0.62)"};
  --arrondi: ${charte.formes?.arrondi ?? 28}px;
  --ombre: ${charte.formes?.ombre === false ? "none" : "0 22px 56px -18px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.08)"};
  --graisse-titres: ${P.titres?.graisse ?? 800}; --approche-titres: ${P.titres?.approche ?? "-0.03em"};
  --graisse-accent: ${P.accent?.graisse ?? 800}; --style-accent: ${P.accent?.italique ? "italic" : "normal"};
  --taille-st: ${st.taille ?? 54}px; --taille-accroche: ${ac.taille ?? 64}px;
}\nbody { font-weight: ${P.texte?.graisse ?? 600}; }\n`
  writeFileSync(join(as, "style.css"), css)
  let logo = null
  if (charte.logo) {
    const src = abs(charte.logo)
    if (existsSync(src)) { logo = `assets/logo${extname(src)}`; copyFileSync(src, join(dir, logo)) }
    else console.warn(`  attention : logo introuvable (${charte.logo}), signature sans logo`)
  }
  return { logo }
}

/** Écrit un projet HyperFrames prêt à rendre. */
export function ecrireCalque(dir, donnees, charte) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const { logo } = preparerAssets(dir, charte)
  // images des animations : copiées dans assets/images
  for (const x of donnees.animations ?? []) {
    if (!x.params?.fichier) continue
    const src = abs(x.params.fichier)
    if (!existsSync(src)) { console.warn(`  attention : image introuvable ${x.params.fichier}`); continue }
    mkdirSync(join(dir, "assets", "images"), { recursive: true })
    const nom = `${x.id ?? Math.random().toString(36).slice(2, 7)}${extname(src)}`
    copyFileSync(src, join(dir, "assets", "images", nom))
    x.params.src = `assets/images/${nom}`
  }
  const D = { ...donnees, logo }
  const html = readFileSync(join(DOSSIERS.kit, "gabarit.html"), "utf8")
    .replaceAll("__LARGEUR__", String(D.largeur)).replaceAll("__HAUTEUR__", String(D.hauteur)).replaceAll("__DUREE__", String(D.duree))
    .replaceAll("__COUCHE__", D.couche).replace("__DONNEES__", JSON.stringify(D).replace(/</g, "\\u003c"))
  writeFileSync(join(dir, "index.html"), html)
  writeFileSync(join(dir, "hyperframes.json"), JSON.stringify({ $schema: "https://hyperframes.heygen.com/schema/hyperframes.json", paths: { assets: "assets" } }, null, 2))
}

/** Résout les temps (repères sur les mots) d'une animation et range ses valeurs par défaut. */
export function resoudreAnimation(x, i, mots, duree, catalogue, detourage) {
  const cat = catalogue[x.type]
  if (!cat) console.warn(`  attention : animation « ${x.type} » absente de kit/animations.json`)
  const R = (v, d) => Math.min(duree, Math.max(0, resoudreTemps(v, mots, d, duree)))
  const debut = R(x.debut, 0)
  let fin = R(x.fin, debut + 2.5)
  if (fin - debut < 0.8) fin = Math.min(duree, debut + 1.5)
  const params = structuredClone(x.params ?? {})
  const fixer = (o) => {
    for (const [k, v] of Object.entries(o)) {
      if (CLES_TEMPS.includes(k)) o[k] = R(v, debut)
      else if (Array.isArray(v)) v.forEach((e) => e && typeof e === "object" && fixer(e))
    }
  }
  fixer(params)
  const place = x.place ?? cat?.place ?? "devant"
  return {
    id: x.id ?? `a${i + 1}`, type: x.type, debut: +debut.toFixed(3), fin: +fin.toFixed(3), place, params,
    flou: x.flou ?? place === "derriere",
    masquer_sous_titres: x.masquer_sous_titres ?? cat?.masquer_sous_titres ?? false,
    couche: place === "derriere" && detourage ? "arriere" : "avant",
  }
}

export function sonsAuto(anims, catalogue, charte, m) {
  const S = charte.sons ?? {}, vol = S.volume ?? -18, ev = []
  const ajouter = (t, role, gain = vol, prio = 1) => { if (S[role]) ev.push({ t: +Math.max(0, t).toFixed(3), fichier: S[role], volume: gain, prio }) }
  if (m.zooms?.accroche && m.zooms?.actif !== false) ajouter(0, "entree", vol + 2, 3)
  for (const x of anims) {
    const cat = catalogue[x.type] ?? {}
    ajouter(x.debut - 0.06, cat.son ?? "texte", x.place === "plein" ? vol + 2 : vol, 2)
    if (cat.son_fin && x.type === "compteur") {
      const au = x.params.au ?? x.debut + 0.35, d = x.params.duree_compte ?? Math.min(1.6, x.fin - au - 0.6)
      ajouter(au + Math.max(0.4, d), cat.son_fin, vol, 3)
    }
  }
  return ev
}

export function preparerCalques(id, o = {}) {
  const journal = o.journal ?? dire
  const m = lireMontage(id)
  const tr = lireTranscription(id)
  const charte = lireCharte()
  const catalogue = lireJson(join(DOSSIERS.kit, "animations.json"))?.animations ?? {}
  const duree = dureeMontage(m)
  if (!duree) stop("Aucune prise gardée : rien à monter. Lance node outils/couper.mjs ou coche des prises.")
  const [L, H] = dimensions(m.format)
  const V = H > L
  const mots = motsFrise(m, tr)
  ecrireJson(join(dossierVideo(id), "mots-montage.json"), { _lire: "Mots de la vidéo montée, temps en secondes sur la frise (pour placer les animations).", duree: +duree.toFixed(3), mots })
  const travail = dossierTravail(id, m)
  const sujet = join(travail, "sujet.webm")
  const detourage = Boolean(m.detourage) && (o.detourageDispo ?? existsSync(sujet))
  if (m.detourage && !detourage) journal("  détourage demandé mais pas encore fait : les animations « derriere » passent devant pour cet aperçu.")

  const anims = (m.animations ?? []).map((x, i) => resoudreAnimation(x, i, mots, duree, catalogue, detourage)).sort((a, b) => a.debut - b.debut)
  for (let i = 1; i < anims.length; i++) {
    const a = anims[i - 1], b = anims[i]
    if (b.debut < a.fin - 0.05 && a.place === b.place) journal(`  attention : « ${a.type} » (${a.debut}-${a.fin} s) et « ${b.type} » (${b.debut}-${b.fin} s) se chevauchent.`)
  }
  const R = (v, d) => Math.min(duree, Math.max(0, resoudreTemps(v, mots, d, duree)))
  const acc = m.accroche?.texte ? { texte: m.accroche.texte, debut: R(m.accroche.debut, 0), fin: R(m.accroche.fin, 2.5), style: m.accroche.style ?? charte.accroche?.style ?? "carte",
    y: m.accroche.y ?? (V ? charte.accroche?.y_vertical ?? 282 : charte.accroche?.y_horizontal ?? 80) } : null
  const st = charte.sous_titres ?? {}
  const masquer = [...(acc && m.sous_titres?.masquer_pendant_accroche !== false ? [[acc.debut, acc.fin]] : []),
    ...anims.filter((x) => x.masquer_sous_titres).map((x) => [x.debut, x.fin])]
  const commun = {
    duree: +duree.toFixed(3), largeur: L, hauteur: H, detourage,
    charte: { mouvement: charte.mouvement, zones: charte.zones, signature: charte.signature },
    accroche: acc, mots,
    sous_titres: { actif: m.sous_titres?.actif !== false, style: m.sous_titres?.style ?? st.style ?? "pilule", y: m.sous_titres?.y ?? (V ? st.y_vertical ?? 1234 : st.y_horizontal ?? 900),
      mots_max: st.mots_max ?? 4, caracteres_max: st.caracteres_max ?? 24, masquer },
    animations: anims,
  }
  const couches = ["avant", ...(detourage && anims.some((x) => x.couche === "arriere") ? ["arriere"] : [])]
  const dirs = {}
  for (const c of couches) {
    dirs[c] = join(travail, "calques", c)
    ecrireCalque(dirs[c], { ...structuredClone(commun), couche: c }, charte)
  }
  const sons = [...(m.sons_auto !== false ? sonsAuto(anims, catalogue, charte, m) : []),
    ...(m.sons ?? []).map((s) => ({ t: R(s.t, 0), fichier: s.fichier, volume: s.volume ?? -18, prio: 4 }))]
  const plan = {
    duree: commun.duree, largeur: L, hauteur: H, detourage, couches: dirs,
    flou: { derriere: detourage ? anims.filter((x) => x.place === "derriere" && x.flou).map((x) => [x.debut, x.fin]) : [], plein: anims.filter((x) => x.place === "plein").map((x) => [x.debut, x.fin]) },
    sons,
  }
  ecrireJson(join(travail, "calques", "plan.json"), plan)
  journal(`Calques prêts : ${couches.join(" + ")} (${anims.length} animations, ${mots.length} mots, accroche ${acc ? "oui" : "non"}).`)
  return plan
}

if (estPrincipal(import.meta.url)) {
  const a = args()
  if (!a._[0]) stop("Usage : node outils/calques.mjs <video>")
  const p = preparerCalques(a._[0])
  for (const [c, d] of Object.entries(p.couches)) dire(`  ${c} : ${d.startsWith(RACINE) ? rel(d) : d}`)
}
export { basename }
