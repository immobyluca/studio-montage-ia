// Propose les coupes : silences retirés, reprises écartées, meilleure prise gardée.
// Usage : node outils/couper.mjs <video> [--choix derniere|energie|premiere]
//
// Méthode (testée sur des rushs réels de 6 et 8 min, plus de 50 reprises chacun) :
//  1. Une « prise » = un passage parlé de la transcription (bornes mesurées au son : les coupes tombent
//     toujours dans un silence, jamais entre deux mots). Si une phrase se termine au milieu d'un passage
//     et qu'un vrai creux suit (0,2 s ou plus), le passage est coupé en deux à cet endroit.
//     Si la phrase RECOMMENCE au milieu d'un passage (« Pour faire ça… Pour faire ça, je vous ai créé… »),
//     il est aussi coupé en deux, juste avant le redémarrage.
//  2. Reprises : deux prises proches sont des reprises si
//     - elles commencent par les mêmes mots (les mots d'attaque « donc », « et », « alors »… ne comptent pas),
//     - ou elles disent la même idée autrement : au moins 3 mots de sens en commun, qui pèsent dans les deux.
//     On garde la DERNIÈRE prise complète (en général la plus fluide). --choix energie garde la plus énergique,
//     --choix premiere la première.
//  3. Hésitations seules (« euh »), consignes de tournage (« je recommence »), phrases abandonnées, et bouts
//     déjà dits en entier dans une prise gardée juste à côté sont écartés.
//  4. Au rendu, on laisse 0,06 s avant le premier son et 0,08 s après le dernier (au moins 120 ms d'air).
// Rien n'est définitif : coche ou décoche les prises dans le dashboard, ou modifie montage.json.
import { existsSync } from "node:fs"
import { join } from "node:path"
import { abs, args, dire, dossierTravail, ffmpeg, hms, s2, stop, estPrincipal } from "./lib/commun.mjs"
import { ecrireMontage, lireMontage, lireTranscription, morceaux } from "./lib/montage.mjs"

const HESITATIONS = new Set(["euh", "heu", "hum", "hmm", "mmh", "bah", "ben", "ah", "oh", "eh", "hein"])
const CONSIGNES = [/je (re)?commence/, /on (la )?(re)?(fait|commence)/, /je reprends/, /\battends?\b/, /\bcoupe[rz]?\b/, /c est pas bon/, /\bpardon\b/]

// mots d'attaque : ils ne changent pas la phrase (« Pour faire ça… » / « Donc pour faire ça… »)
const ATTAQUES = new Set(["donc", "et", "alors", "bon", "bah", "ben", "mais", "puis", "voila", "ok", "ah", "oh", "oui", "enfin", "ensuite", "bref"])
// mots sans sens propre, ignorés pour comparer deux idées
const VIDES = new Set(("le la les l un une des de du d a au aux et ou mais donc or ni car que qu qui quoi dont ce cet cette ces ca c est sont " +
  "etre etait ai as avons avez ont avoir je j tu t il elle on nous vous ils elles me m te se s moi toi lui leur leurs mon ma mes ton ta tes " +
  "son sa ses notre votre nos vos y en ne n pas plus tres tout tous toute toutes pour par sur dans avec sans sous chez si alors bon bah ben " +
  "voila ok oui non ah oh juste fait faire va vais vas allez aller peut peux veux vont comme aussi bien meme quand parce puis enfin ensuite deja vraiment").split(" "))

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9% ]/g, " ").split(/\s+/).filter(Boolean)
const jetons = (texte) => norm(texte).filter((w) => !HESITATIONS.has(w))
/** Retire les mots d'attaque du début (« donc », « et », « du coup », « en fait »…). */
function sansAttaque(j) {
  let k = 0
  while (k < 3 && k < j.length - 1) {
    if (ATTAQUES.has(j[k])) k++
    else if ((j[k] === "du" && j[k + 1] === "coup") || (j[k] === "en" && j[k + 1] === "fait")) k += 2
    else break
  }
  return j.slice(k)
}
/** Mots de sens d'une phrase, sans les terminaisons (« collent » = « colle », « posts » = « post »). */
const sens = (texte) => [...new Set(norm(texte).filter((w) => w.length > 1 && !VIDES.has(w) && !HESITATIONS.has(w)).map((w) => (w.length >= 4 ? w.replace(/(ent|es|s|e)$/, "") : w)))]

/** Même idée dite autrement : au moins 3 mots de sens en commun, qui pèsent dans les deux phrases
 *  (la moitié de la plus courte, 40 % de la plus longue). Une phrase qui en prolonge une autre ne compte pas. */
function memeIdee(a, b) {
  if (a.length < 3 || b.length < 3) return false
  const n = a.filter((w) => b.includes(w)).length
  return n >= 3 && n / Math.min(a.length, b.length) >= 0.5 && n / Math.max(a.length, b.length) >= 0.4
}

/** Coupe une prise là où la phrase recommence : après une fin de phrase, les 3 premiers mots reviennent
 *  (2 suffisent après des points de suspension). Exemple : « Vous allez… Vous allez pouvoir mettre. » */
function redemarrages(p) {
  const toks = [], mot = []
  p.mots.forEach((x, i) => jetons(x.texte).forEach((t) => { toks.push(t); mot.push(i) }))
  const s0 = toks.length - sansAttaque(toks).length
  if (toks.length - s0 < 4) return [p]
  for (let q = s0 + 2; q < toks.length - 1; q++) {
    if (mot[q] === mot[q - 1]) continue
    const avant = p.mots[mot[q] - 1].texte
    if (!/[.!?…]$/.test(avant)) continue
    const n = /(\.\.\.|…)$/.test(avant) ? 2 : 3
    const r = toks.length - sansAttaque(toks.slice(q)).length
    if (r + n > toks.length || toks.slice(r, r + n).join(" ") !== toks.slice(s0, s0 + n).join(" ")) continue
    const i = mot[q], a = p.mots[i - 1], b = p.mots[i], c = (a.fin + b.debut) / 2
    return [{ debut: p.debut, fin: Math.min(a.fin + 0.05, c), mots: p.mots.slice(0, i) },
      ...redemarrages({ debut: Math.max(b.debut - 0.05, c), fin: p.fin, mots: p.mots.slice(i) })]
  }
  return [p]
}

/** Ressemblance des débuts de deux phrases (0 à 1). Deux mesures, on garde la meilleure :
 *  - mêmes premiers mots dans le même ordre (un mot de décalage toléré) ;
 *  - mêmes premiers mots dans le désordre (« déjà premièrement des trends tu peux » / « déjà premièrement si tu veux des trends »),
 *    seulement à partir de 3 mots pour éviter de confondre deux phrases qui commencent par « c'est ». */
function debutCommun(a, b) {
  const n = Math.min(a.length, b.length, 6)
  if (n < 2) return 0
  let k = 0
  for (let i = 0; i < n; i++) if (a[i] === b[i] || (i > 0 && (a[i] === b[i - 1] || a[i - 1] === b[i]))) k++
  let sac = 0
  if (n >= 3) { const reste = b.slice(0, n + 1); for (const w of a.slice(0, n)) { const j = reste.indexOf(w); if (j >= 0) { sac++; reste.splice(j, 1) } } }
  return Math.max(k / n, a[0] === b[0] ? sac / n : 0)
}

async function energie(wav, a, b) {
  const r = await ffmpeg(["-nostats", "-ss", String(a), "-t", String(Math.max(0.1, b - a)), "-i", wav, "-af", "astats=measure_overall=RMS_level:measure_perchannel=none", "-f", "null", "-"], { tolerer: true })
  return Number(/RMS level dB: (-?[\d.]+)/.exec(r.erreurs)?.[1] ?? -99)
}

export async function couper(id, o = {}) {
  const journal = o.journal ?? dire
  const m = lireMontage(id)
  const tr = lireTranscription(id)
  if (!tr) stop(`Pas encore de transcription. Lance d'abord : node outils/transcrire.mjs ${id}`)
  if (!tr.blocs) stop(`Transcription d'un ancien format : relance node outils/transcrire.mjs ${id}`)
  const reg = { ...m.reglages_coupes, ...(o.choix ? { choix: o.choix } : {}) }

  // 1. Prises
  const liste = []
  tr.blocs.forEach((B, k) => {
    if (!B.texte) return
    const ws = tr.mots.filter((w) => w.bloc === k + 1)
    let debut = B.debut, courant = []
    ws.forEach((w, i) => {
      courant.push(w)
      const s = ws[i + 1]
      if (s && /[.!?…]$/.test(w.texte) && s.debut - w.fin >= 0.2) {
        const c = (w.fin + s.debut) / 2
        liste.push({ debut, fin: c - 0.08, mots: courant }); debut = c + 0.06; courant = []
      }
    })
    if (courant.length) liste.push({ debut, fin: B.fin, mots: courant })
  })
  const prises = liste.flatMap(redemarrages).map((p, i) => {
    const texte = p.mots.map((w) => w.texte).join(" ")
    const j = jetons(texte)
    return { id: i + 1, texte, debut: +p.debut.toFixed(3), fin: +p.fin.toFixed(3), morceaux: [[+p.debut.toFixed(3), +p.fin.toFixed(3)]], garder: true, raison: "", _j: j, _d: sansAttaque(j), _s: sens(texte) }
  })

  // 2 et 3. Hésitations, consignes, reprises
  for (const p of prises) {
    const t = norm(p.texte).join(" ")
    if (!p._j.length) { p.garder = false; p.raison = "hésitation seule" }
    else if (CONSIGNES.some((r) => r.test(t)) && p._j.length <= 6) { p.garder = false; p.raison = "consigne de tournage" }
    else if (p.fin - p.debut < 0.5) { p.garder = false; p.raison = "trop court (bruit ou mot isolé)" }
    else if (/(\.\.\.|…)$/.test(p.texte.trim()) && p._j.length <= 4) { p.garder = false; p.raison = "phrase abandonnée" }
  }
  const groupe = prises.map((_, i) => i)
  const racine = (i) => (groupe[i] === i ? i : (groupe[i] = racine(groupe[i])))
  for (let i = 0; i < prises.length; i++) {
    if (!prises[i].garder) continue
    for (let j = i + 1; j < prises.length && j <= i + 8; j++) {
      if (prises[j].debut - prises[i].fin > 120 || !prises[j].garder) continue
      if (debutCommun(prises[i]._d, prises[j]._d) >= 0.6 || memeIdee(prises[i]._s, prises[j]._s)) groupe[racine(j)] = racine(i)
    }
  }
  const groupes = new Map()
  prises.forEach((p, i) => { if (p.garder) { const g = racine(i); if (!groupes.has(g)) groupes.set(g, []); groupes.get(g).push(p) } })
  const travail = dossierTravail(id, m)
  const wav = join(travail, "voix-16k.wav")
  let nReprises = 0
  for (const membres of groupes.values()) {
    if (membres.length < 2) continue
    const max = Math.max(...membres.map((p) => p._j.length))
    const completes = membres.filter((p) => p._j.length >= Math.max(2, 0.8 * max))
    let elue = completes.at(-1)
    if (reg.choix === "premiere") elue = completes[0]
    if (reg.choix === "energie" && existsSync(wav)) {
      for (const p of completes) p._e = await energie(wav, p.debut, p.fin)
      elue = completes.reduce((x, y) => (y._e > x._e + 0.5 ? y : x))
    }
    for (const p of membres) {
      p.groupe = membres[0].id
      if (p !== elue) { p.garder = false; p.raison = `reprise (prise ${elue.id} gardée)`; nReprises++ }
    }
  }
  // 4. Bouts déjà dits : une prise courte dont tous les mots de sens sont dans une prise gardée plus longue,
  //    juste à côté (« et qu'elles collent à votre branding » quand la prise suivante dit toute la phrase)
  prises.forEach((p, i) => {
    if (!p.garder || p._j.length > 8 || p._s.length < 2) return
    const q = prises.find((x, j) => x !== p && x.garder && Math.abs(j - i) <= 8 && Math.abs(x.debut - p.debut) <= 120 && x._j.length > p._j.length && p._s.every((w) => x._s.includes(w)))
    if (q) { p.garder = false; p.raison = `déjà dit dans la prise ${q.id}` }
  })
  for (const p of prises) { delete p._j; delete p._d; delete p._s; delete p._e }

  m.reglages_coupes = reg
  m.prises = prises
  m.coupes_auto = { cree: new Date().toISOString() }
  ecrireMontage(id, m)

  const d = morceaux(m).at(-1)?.tl[1] ?? 0
  const rush = tr.blocs.at(-1)?.fin ?? 0
  journal(`${prises.length} prises, ${prises.filter((p) => p.garder).length} gardées, ${nReprises} reprises écartées. Durée montée : ${hms(d)} (parole du rush jusqu'à ${hms(rush)}).`)
  for (const p of prises) journal(`${p.garder ? "  ✓" : "  ✗"} ${String(p.id).padStart(3)}  ${s2(p.debut).padStart(7)}-${s2(p.fin).padEnd(7)} ${p.texte.slice(0, 80)}${p.texte.length > 80 ? "…" : ""}${p.raison ? `   [${p.raison}]` : ""}`)
  if (m.format === "9:16" && d > 90) journal("\nConseil : plus de 90 s pour un Reel. Resserre : écarte des prises (dashboard ou montage.json).")
  return m
}

if (estPrincipal(import.meta.url)) {
  const a = args()
  if (!a._[0]) stop("Usage : node outils/couper.mjs <video> [--choix derniere|energie|premiere]")
  await couper(a._[0], { choix: a.choix })
  dire(`\nVérifie les prises (✓ gardée, ✗ écartée) puis : node outils/rendre.mjs ${a._[0]} --apercu`)
}
export { abs }
