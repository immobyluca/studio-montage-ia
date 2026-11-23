// Interface du dashboard (JavaScript simple, sans compilation : modifie ce fichier et recharge la page).
// Tout passe par l'API du serveur (dashboard/serveur.mjs). Le montage vit dans videos/<video>/montage.json,
// partagé avec ton IA : si elle le modifie, la page se met à jour toute seule.

const $ = (s) => document.querySelector(s)
const S = { etat: null, id: localStorage.getItem("video") || null, v: null, etape: "prises", kit: null, sons: [], style: null, source: "apercu", enAttente: null, travailAvant: false }

// ---------- Petits outils ----------
function h(tag, props = {}, ...enfants) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v)
    else if (k === "class") el.className = v
    else if (k in el && k !== "list") el[k] = v
    else el.setAttribute(k, v === true ? "" : v)
  }
  for (const e of enfants.flat()) if (e != null && e !== false) el.append(e instanceof Node ? e : String(e))
  return el
}
async function api(methode, url, corps) {
  const r = await fetch(url, { method: methode, headers: corps ? { "Content-Type": "application/json" } : {}, body: corps ? JSON.stringify(corps) : undefined })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.erreur || `Erreur ${r.status}`)
  return j
}
let minuteurToast
function toast(t) { const e = $("#toast"); e.textContent = t; e.classList.add("vu"); clearTimeout(minuteurToast); minuteurToast = setTimeout(() => e.classList.remove("vu"), 3800) }
const temps = (s) => { s = Number(s) || 0; const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}` }
const enCours = () => Boolean(S.etat?.travail?.en_cours)

// ---------- Chargement ----------
async function chargerEtat() {
  S.etat = await api("GET", "/api/etat")
  const sel = $("#choix-video"); sel.replaceChildren()
  if (!S.etat.videos.length) sel.append(h("option", { value: "" }, "Aucune vidéo : clique sur « + Nouvelle vidéo »"))
  for (const v of S.etat.videos) sel.append(h("option", { value: v.id }, `${v.titre}  ·  ${v.format}  ·  ${v.duree ? temps(v.duree) : "pas encore coupée"}`))
  if (!S.etat.videos.some((v) => v.id === S.id)) S.id = S.etat.videos[0]?.id ?? null
  sel.value = S.id ?? ""
  const manque = S.etat.outils.filter((x) => !x.ok && x.obligatoire)
  const p = $("#etat-outils"); p.textContent = manque.length ? `${manque.length} outil(s) à installer` : "Outils prêts"; p.classList.toggle("ko", manque.length > 0)
}
async function chargerVideo() {
  if (!S.id) { S.v = null; return }
  S.v = await api("GET", `/api/videos/${S.id}`)
}
async function toutCharger() {
  await chargerEtat()
  await chargerVideo().catch((e) => toast(e.message))
  rendre()
}

// ---------- Enregistrement (automatique, 0,6 s après la dernière modif) ----------
function modifie() {
  clearTimeout(S.enAttente)
  S.enAttente = setTimeout(enregistrer, 600)
}
async function enregistrer() {
  S.enAttente = null
  try {
    const r = await api("PUT", `/api/videos/${S.id}/montage`, { ...S.v.montage, version: S.v.version })
    S.v.version = r.version
    const frais = await api("GET", `/api/videos/${S.id}`)
    Object.assign(S.v, { duree: frais.duree, pieces: frais.pieces, mots_montage: frais.mots_montage })
    majInfo(); rendreRail()
  } catch (e) { toast(e.message); await chargerVideo(); rendre() }
}

// ---------- Rail des étapes ----------
const ETAPES = [
  ["prises", "Prises"], ["texte", "Texte"], ["animations", "Animations"], ["sons", "Sons"], ["rendu", "Rendu"],
]
function rendreRail() {
  const m = S.v?.montage
  const fait = { prises: m?.prises?.length > 0, texte: Boolean(m?.accroche?.texte), animations: m?.animations?.length > 0, sons: Boolean(m?.sons_auto || m?.sons?.length), rendu: Boolean(S.v?.rendu) }
  $("#rail").replaceChildren(...ETAPES.map(([id, nom], i) => h("button", { class: `${S.etape === id ? "actif" : ""} ${fait[id] ? "fait" : ""}`, onclick: () => { S.etape = id; rendre() } }, h("span", { class: "n" }, fait[id] ? "✓" : i + 1), nom)))
}

// ---------- Panneaux ----------
function bouton(texte, action, o = {}) { return h("button", { class: o.secondaire ? "secondaire" : "", disabled: enCours() || o.desactive, onclick: action, title: o.titre }, texte) }
async function lancer(action) {
  try { await api("POST", `/api/videos/${S.id}/action`, { action }); toast("C'est parti. Suis l'avancement en bas."); suivreTravail() } catch (e) { toast(e.message) }
}

function panneauPrises() {
  const m = S.v.montage, prises = m.prises ?? []
  const gardees = prises.filter((p) => p.garder)
  const liste = h("div", { class: "prises" })
  for (const p of prises) {
    const coche = h("input", { type: "checkbox", checked: p.garder, onclick: (e) => e.stopPropagation(), onchange: (e) => { p.garder = e.target.checked; if (p.garder) p.raison = ""; modifie(); ligne.classList.toggle("ecartee", !p.garder) } })
    const ligne = h("div", { class: `prise ${p.garder ? "" : "ecartee"}`, title: "Clique pour écouter cette prise dans le rush", onclick: () => ecouter(p) },
      coche, h("span", { class: "num" }, p.id), h("span", { class: "tps" }, `${temps(p.debut)} → ${temps(p.fin)}`), h("span", { class: "texte" }, p.texte), p.raison ? h("span", { class: "raison" }, p.raison) : "")
    liste.append(ligne)
  }
  return [
    h("h2", {}, "Prises"),
    h("span", { class: "aide" }, "Ce que tu dis, phrase par phrase. Coche ce que tu gardes. Les reprises et les « euh » sont déjà écartés : vérifie quand même. Clique une ligne pour l'écouter."),
    h("div", { class: "ligne" }, bouton(S.v.transcription ? "Retranscrire" : "1. Transcrire", () => lancer("transcrire"), { secondaire: Boolean(S.v.transcription), desactive: !S.v.rush_present }),
      bouton(prises.length ? "Reproposer les coupes" : "2. Proposer les coupes", () => { if (!prises.length || confirm("Recalculer les coupes ? Tes coches actuelles seront remplacées.")) lancer("couper") }, { desactive: !S.v.transcription, secondaire: prises.length > 0 })),
    !S.v.rush_present ? h("p", { class: "aide" }, `Rush introuvable (${m.rush}). Disque externe débranché ?`) : "",
    h("div", { class: "resume" }, h("div", {}, h("b", {}, `${gardees.length} / ${prises.length}`), "prises gardées"), h("div", {}, h("b", {}, temps(S.v.duree)), "durée montée"),
      h("div", {}, h("b", {}, S.v.transcription ? S.v.transcription.mots : "0"), "mots transcrits")),
    prises.length ? liste : h("p", { class: "vide" }, S.v.transcription ? "Clique sur « Proposer les coupes »." : "Commence par « Transcrire » (Whisper, sur ton ordinateur)."),
  ]
}

function champTemps(obj, cle, etiquette) {
  return h("label", {}, etiquette, h("input", { value: obj[cle] ?? "", placeholder: "secondes ou mot:exemple", onchange: (e) => { const v = e.target.value.trim(); obj[cle] = v === "" ? undefined : isNaN(Number(v)) ? v : Number(v); modifie() } }))
}

function panneauTexte() {
  const m = S.v.montage
  m.accroche ??= { texte: "", debut: 0, fin: 2.5 }; m.sous_titres ??= { actif: true }; m.remplacements ??= {}; m.zooms ??= { actif: true, motif: [1, 1.15], accroche: true }
  const remp = h("div", { class: "prises" })
  const dessinerRemp = () => {
    remp.replaceChildren(...Object.entries(m.remplacements).map(([faux, bon]) => h("div", { class: "grille3" },
      h("input", { value: faux, disabled: true }), h("input", { value: bon, onchange: (e) => { m.remplacements[faux] = e.target.value; modifie() } }),
      h("button", { class: "secondaire mini", onclick: () => { delete m.remplacements[faux]; modifie(); dessinerRemp() } }, "Retirer"))))
  }
  dessinerRemp()
  const nf = h("input", { placeholder: "mot mal entendu (ex. trains)" }), nb = h("input", { placeholder: "bon mot (ex. trends)" })
  return [
    h("h2", {}, "Texte"),
    h("span", { class: "aide" }, "Le titre d'accroche se lit dès la première image. Mets *un mot* entre astérisques pour le faire ressortir. Retour à la ligne : Entrée."),
    h("h3", {}, "Titre d'accroche"),
    h("textarea", { rows: 2, value: m.accroche.texte ?? "", placeholder: "Ton estimation\nest *fausse*", oninput: (e) => { m.accroche.texte = e.target.value; modifie() } }),
    h("div", { class: "grille3" }, champTemps(m.accroche, "debut", "Début"), champTemps(m.accroche, "fin", "Fin (ex. 2.5 ou fin:prix)"),
      h("label", {}, "Style", h("select", { onchange: (e) => { m.accroche.style = e.target.value; modifie() } }, ...["carte", "gros"].map((s) => h("option", { value: s, selected: (m.accroche.style ?? "carte") === s }, s === "carte" ? "Carte" : "Gros texte"))))),
    h("h3", {}, "Sous-titres mot à mot"),
    h("div", { class: "ligne" },
      h("label", { style: "flex-direction:row;align-items:center" }, h("input", { type: "checkbox", checked: m.sous_titres.actif !== false, onchange: (e) => { m.sous_titres.actif = e.target.checked; modifie() } }), "Afficher"),
      h("label", { style: "flex-direction:row;align-items:center" }, h("input", { type: "checkbox", checked: m.sous_titres.masquer_pendant_accroche !== false, onchange: (e) => { m.sous_titres.masquer_pendant_accroche = e.target.checked; modifie() } }), "Cachés pendant l'accroche"),
      h("select", { style: "width:auto", onchange: (e) => { m.sous_titres.style = e.target.value || undefined; modifie() } }, ...[["", "Style de ma charte"], ["pilule", "Pilule"], ["contour", "Contour"], ["simple", "Simple"]].map(([v, t]) => h("option", { value: v, selected: (m.sous_titres.style ?? "") === v }, t)))),
    h("h3", {}, "Corriger un mot mal entendu (partout)"), remp,
    h("div", { class: "grille3" }, nf, nb, h("button", { class: "secondaire", onclick: () => { if (!nf.value.trim()) return; m.remplacements[nf.value.trim()] = nb.value.trim(); modifie(); dessinerRemp(); nf.value = nb.value = "" } }, "Ajouter")),
    h("h3", {}, "Zooms"),
    h("div", { class: "ligne" },
      h("label", { style: "flex-direction:row;align-items:center" }, h("input", { type: "checkbox", checked: m.zooms.actif !== false, onchange: (e) => { m.zooms.actif = e.target.checked; modifie() } }), "Zoom alterné à chaque coupe"),
      h("label", { style: "flex-direction:row;align-items:center" }, h("input", { type: "checkbox", checked: Boolean(m.zooms.accroche), onchange: (e) => { m.zooms.accroche = e.target.checked; modifie() } }), "Zoom d'élan sur l'accroche")),
    h("label", {}, "Niveaux de zoom (ex. 1, 1.15)", h("input", { value: (m.zooms.motif ?? [1, 1.15]).join(", "), onchange: (e) => { m.zooms.motif = e.target.value.split(/[,; ]+/).map(Number).filter((x) => x >= 1 && x <= 2); modifie() } })),
  ]
}

function aideMots() {
  const mots = S.v.mots_montage
  if (!mots?.length) return h("p", { class: "aide" }, "Les mots apparaîtront ici après un premier aperçu (pour placer les animations sur un mot).")
  return h("div", { class: "mots" }, ...mots.map((w) => h("span", { title: `${w.debut.toFixed(2)} s : clique pour copier le repère`, onclick: () => { const r = `mot:${w.texte.replace(/[.,!?…;:]+$/, "").toLowerCase()}@${Math.max(0, w.debut - 0.3).toFixed(1)}`; navigator.clipboard?.writeText(r); toast(`Repère copié : ${r}`) } }, w.texte)))
}

function panneauAnimations() {
  const m = S.v.montage; m.animations ??= []
  const cat = S.kit?.animations ?? {}
  const choix = h("select", {}, ...Object.entries(cat).map(([k, x]) => h("option", { value: k }, x.nom)))
  const desc = h("p", { class: "aide" }, cat[choix.value]?.quand ?? "")
  choix.onchange = () => { desc.textContent = cat[choix.value]?.quand ?? "" }
  const cartes = m.animations.map((x, i) => {
    const params = h("textarea", { rows: 5, value: JSON.stringify(x.params ?? {}, null, 1), onchange: (e) => { try { x.params = JSON.parse(e.target.value); e.target.style.borderColor = ""; modifie() } catch { e.target.style.borderColor = "#b00020"; toast("Paramètres invalides (vérifie les guillemets et les virgules)") } } })
    return h("div", { class: "carte-anim" },
      h("div", { class: "entete" }, h("b", {}, cat[x.type]?.nom ?? x.type),
        h("select", { style: "width:auto", onchange: (e) => { x.place = e.target.value || undefined; modifie() } }, ...[["", "Place par défaut"], ["devant", "Devant"], ["derriere", "Derrière moi"], ["plein", "Plein écran"]].map(([v, t]) => h("option", { value: v, selected: (x.place ?? "") === v }, t))),
        h("button", { class: "secondaire mini", onclick: () => { m.animations.splice(i, 1); modifie(); rendre() } }, "Retirer")),
      h("div", { class: "grille2" }, champTemps(x, "debut", "Début"), champTemps(x, "fin", "Fin")),
      h("label", {}, "Paramètres", params))
  })
  return [
    h("h2", {}, "Animations"),
    h("span", { class: "aide" }, "Pose une animation sur un moment de ta vidéo. Les temps peuvent être un mot (mot:mandat) : ils suivent tes coupes. Le plus simple : demande à ton IA de les placer, puis ajuste ici."),
    h("div", { class: "ligne" }, choix, h("button", { onclick: () => { const ex = structuredClone(cat[choix.value]?.exemple ?? { type: choix.value }); ex.type = choix.value; if (typeof ex.debut !== "number") ex.debut = 1; if (typeof ex.fin !== "number" && ex.fin !== "fin") ex.fin = 4; m.animations.push(ex); modifie(); rendre() } }, "Ajouter")),
    desc,
    ...(cartes.length ? cartes : [h("p", { class: "vide" }, "Aucune animation pour l'instant.")]),
    h("h3", {}, "Mots de la vidéo montée"), aideMots(),
  ]
}

function panneauSons() {
  const m = S.v.montage; m.sons ??= []; m.musique ??= { fichier: null, volume: -26 }
  const options = (val) => S.sons.map((s) => h("option", { value: s.fichier, selected: s.fichier === val }, s.nom))
  const jouer = (f) => { const s = S.sons.find((x) => x.fichier === f); if (s) new Audio(s.url).play() }
  return [
    h("h2", {}, "Sons"),
    h("span", { class: "aide" }, "Par défaut, un petit son discret accompagne l'entrée de chaque animation (sons choisis dans ta charte). Tout est mixé à -14 LUFS, le volume des réseaux."),
    h("label", { style: "flex-direction:row;align-items:center;margin:8px 0" }, h("input", { type: "checkbox", checked: m.sons_auto !== false, onchange: (e) => { m.sons_auto = e.target.checked; modifie() } }), "Sons automatiques sur les animations"),
    h("h3", {}, "Sons ajoutés à la main"),
    ...m.sons.map((s, i) => h("div", { class: "grille3", style: "margin-bottom:6px;grid-template-columns:2fr 1fr 1fr auto auto" },
      h("select", { onchange: (e) => { s.fichier = e.target.value; modifie() } }, ...options(s.fichier)),
      h("input", { value: s.t ?? 0, title: "Instant (secondes ou mot:…)", onchange: (e) => { const v = e.target.value.trim(); s.t = isNaN(Number(v)) ? v : Number(v); modifie() } }),
      h("input", { type: "number", value: s.volume ?? -18, step: 1, title: "Volume en dB", onchange: (e) => { s.volume = Number(e.target.value); modifie() } }),
      h("button", { class: "secondaire mini", onclick: () => jouer(s.fichier) }, "▶"),
      h("button", { class: "secondaire mini", onclick: () => { m.sons.splice(i, 1); modifie(); rendre() } }, "✕"))),
    h("button", { class: "secondaire", onclick: () => { m.sons.push({ fichier: S.sons[0]?.fichier, t: 1, volume: -18 }); modifie(); rendre() } }, "+ Ajouter un son"),
    h("h3", {}, "Musique de fond (optionnelle)"),
    h("div", { class: "grille2" }, h("label", {}, "Fichier (chemin dans le studio)", h("input", { value: m.musique.fichier ?? "", placeholder: "sons/ma-musique.mp3", onchange: (e) => { m.musique.fichier = e.target.value.trim() || null; modifie() } })),
      h("label", {}, "Volume (dB)", h("input", { type: "number", value: m.musique.volume ?? -26, onchange: (e) => { m.musique.volume = Number(e.target.value); modifie() } }))),
    h("p", { class: "aide" }, "Utilise seulement une musique que tu as le droit d'utiliser (libre de droits, ou achetée)."),
    h("h3", {}, "Bibliothèque (sons libres CC0)"),
    h("div", { class: "mots" }, ...S.sons.map((s) => h("span", { onclick: () => jouer(s.fichier), title: "Écouter" }, `▶ ${s.nom}`))),
  ]
}

function controles(r) {
  if (!r) return ""
  const c = r.controles ?? {}
  return h("div", {},
    h("div", { class: "controle" }, `${r.ok ? "✓" : "⚠"} ${r.fichier}  (${new Date(r.date).toLocaleString("fr-FR")}, rendu en ${r.duree_rendu_s} s)`),
    c.duree ? h("div", { class: "controle" }, `${c.duree.ok ? "✓" : "⚠"} Durée ${temps(c.duree.obtenu)}`) : "",
    c.volume ? h("div", { class: "controle" }, `${c.volume.ok ? "✓" : "⚠"} Volume ${c.volume.lufs} LUFS, crête ${c.volume.crete} dBFS`) : "",
    c.image ? h("div", { class: "controle" }, `${c.image.ok ? "✓" : "⚠"} Image ${c.image.obtenu}`) : "")
}

function panneauRendu() {
  const m = S.v.montage
  return [
    h("h2", {}, "Rendu"),
    h("span", { class: "aide" }, "L'aperçu est petit et rapide, pour vérifier. Le rendu final (1080x1920, 30 i/s) va dans le dossier finies. Rien n'est publié."),
    h("div", { class: "ligne" }, bouton("Aperçu rapide", () => lancer("apercu"), { desactive: !m.prises?.some((p) => p.garder) }), bouton("Rendu final", () => lancer("rendu"), { desactive: !m.prises?.some((p) => p.garder) }),
      bouton("Planche d'images", () => lancer("images"), { secondaire: true, desactive: !S.v.apercu })),
    h("h3", {}, "Dernier aperçu"), controles(S.v.apercu_controles) || h("p", { class: "aide" }, "Pas encore d'aperçu."),
    S.v.planche ? h("img", { class: "planche", src: S.v.planche, alt: "Planche d'images de l'aperçu" }) : "",
    h("h3", {}, "Rendu final"), controles(S.v.rendu) || h("p", { class: "aide" }, "Pas encore de rendu final."),
    h("h3", {}, "Option : détourage"),
    h("p", { class: "aide" }, "Découpe ta silhouette pour poser des animations derrière toi et flouter le fond. Marche sur Mac et Windows, mais c'est long (1 à 3 min par 10 s de vidéo). À refaire après chaque changement de coupes."),
    h("div", { class: "ligne" }, bouton(S.v.detourage_pret ? "Refaire le détourage" : "Lancer le détourage", () => lancer("detourer"), { secondaire: true }),
      h("label", { style: "flex-direction:row;align-items:center" }, h("input", { type: "checkbox", checked: Boolean(m.detourage), onchange: (e) => { m.detourage = e.target.checked; modifie() } }), "Utiliser le détourage au rendu")),
  ]
}

async function panneauStyle() {
  if (!S.style) S.style = await api("GET", "/api/style")
  const c = S.style.charte
  const champ = (obj, cle, etiquette, type = "text") => h("label", {}, etiquette, h("input", { type, value: obj[cle] ?? "", onchange: (e) => { obj[cle] = type === "number" ? Number(e.target.value) : e.target.value } }))
  const couleur = (cle, etiquette) => h("label", {}, h("input", { type: "color", value: /^#[0-9a-f]{6}$/i.test(c.couleurs[cle] ?? "") ? c.couleurs[cle] : "#ffffff", oninput: (e) => { c.couleurs[cle] = e.target.value.toUpperCase() } }), etiquette)
  c.signature ??= { nom: "", compte: "" }; c.sous_titres ??= {}; c.accroche ??= {}; c.formes ??= {}
  return [
    h("h2", {}, "Mon style"),
    h("span", { class: "aide" }, "Le plus simple : dis à ton IA « crée mon style » et envoie-lui une capture de ton profil Instagram (ou tes couleurs et ton logo). Elle remplit tout ça pour toi. Tu peux aussi ajuster ici, puis « Voir la galerie »."),
    h("p", {}, h("b", {}, c.nom ?? "Mon style")),
    h("h3", {}, "Couleurs"),
    h("div", { class: "couleurs" }, couleur("surface", "Cartes"), couleur("texte", "Texte sur cartes"), couleur("accent", "Capsule d'accent"), couleur("texte_accent", "Texte sur capsule"),
      couleur("clair", "Carte mise en avant"), couleur("texte_clair", "Texte sur carte mise en avant"), couleur("attention", "Barré, croix"), couleur("texte_attention", "Texte sur barré")),
    h("h3", {}, "Polices"),
    h("div", { class: "grille2" }, champ(c.polices.titres, "fichier", "Titres (fichier .ttf)"), champ(c.polices.titres, "graisse", "Graisse des titres", "number"),
      champ(c.polices.texte, "fichier", "Texte (fichier .ttf)"), champ(c.polices.accent, "fichier", "Mot d'accent (fichier .ttf)")),
    h("h3", {}, "Formes et tailles"),
    h("div", { class: "grille3" }, champ(c.formes, "arrondi", "Arrondi (px)", "number"), champ(c.sous_titres, "taille", "Taille des sous-titres", "number"), champ(c.accroche, "taille", "Taille de l'accroche", "number"),
      h("label", {}, "Style des sous-titres", h("select", { onchange: (e) => { c.sous_titres.style = e.target.value } }, ...["pilule", "contour", "simple"].map((s) => h("option", { value: s, selected: c.sous_titres.style === s }, s)))),
      champ(c.sous_titres, "y_vertical", "Hauteur des sous-titres (9:16)", "number"), champ(c, "logo", "Logo (ex. mon-style/logo/logo.png)")),
    h("h3", {}, "Signature de fin"),
    h("div", { class: "grille2" }, champ(c.signature, "nom", "Ton nom"), champ(c.signature, "compte", "Ton compte (ex. @moncompte)")),
    h("div", { class: "ligne", style: "margin-top:14px" },
      h("button", { onclick: async () => { try { await api("PUT", "/api/style", c); toast("Style enregistré. Lance « Voir la galerie » pour le voir.") } catch (e) { toast(e.message) } } }, "Enregistrer"),
      bouton("Voir la galerie", async () => { try { await api("PUT", "/api/style", c); await api("POST", "/api/galerie"); toast("Rendu de la galerie lancé (environ 30 s)."); suivreTravail() } catch (e) { toast(e.message) } }, { secondaire: true })),
  ]
}

function panneauOutils() {
  return [h("h2", {}, "Outils"), h("span", { class: "aide" }, "Ce qui manque s'installe avec : node outils/installer.mjs (ou demande à ton IA « installe ce qui manque »)."),
    ...S.etat.outils.map((x) => h("div", { class: "controle" }, `${x.ok ? "✓" : x.obligatoire ? "✗" : "·"} ${x.nom} : ${x.detail}`, x.ok ? "" : h("div", { class: "aide" }, `→ ${x.aide}`)))]
}

async function rendrePanneau() {
  const p = $("#panneau")
  if (S.etape === "style") { p.replaceChildren(...await panneauStyle()); return }
  if (S.etape === "outils") { p.replaceChildren(...panneauOutils()); return }
  if (!S.v) {
    p.replaceChildren(h("h2", {}, "Bienvenue"), h("p", {}, "1. Dépose ta vidéo (filmée au téléphone) dans le dossier a-monter du studio."), h("p", {}, "2. Clique sur « + Nouvelle vidéo »."),
      h("p", {}, "3. Transcris, propose les coupes, ajoute ton texte et tes animations, puis lance l'aperçu."), h("p", { class: "aide" }, "Tu peux aussi tout demander à ton IA : elle travaille sur les mêmes fichiers que ce dashboard."))
    return
  }
  const f = { prises: panneauPrises, texte: panneauTexte, animations: panneauAnimations, sons: panneauSons, rendu: panneauRendu }[S.etape]
  p.replaceChildren(...f())
}

// ---------- Lecteur ----------
function majLecteur() {
  const v = $("#video"), vide = $("#sans-video")
  let src = null
  if (S.etape === "style") src = S.style?.galerie ?? null
  else if (S.v) src = S.source === "rush" ? S.v.rush : S.v.apercu
  document.querySelectorAll(".onglets-lecteur button").forEach((b) => b.classList.toggle("actif", b.dataset.source === S.source))
  if (src && v.getAttribute("src") !== src) v.src = src
  if (!src) { v.removeAttribute("src"); v.load() }
  v.style.display = src ? "block" : "none"
  vide.textContent = S.etape === "style" ? "Clique sur « Voir la galerie »." : S.v ? "Pas encore d'aperçu : onglet Rendu." : "Aucune vidéo."
  vide.style.display = src ? "none" : "block"
  majInfo()
}
function majInfo() {
  $("#info-lecteur").textContent = S.v ? `${S.v.montage.titre || S.id} · ${S.v.montage.format} · ${temps(S.v.duree)} montées · ${(S.v.montage.animations ?? []).length} animation(s)` : ""
}
function ecouter(p) {
  S.source = "rush"; majLecteur()
  const v = $("#video")
  const go = () => { v.currentTime = p.debut; v.play(); const stop = () => { if (v.currentTime >= p.fin) { v.pause(); v.removeEventListener("timeupdate", stop) } }; v.addEventListener("timeupdate", stop) }
  if (v.readyState >= 1) go(); else v.addEventListener("loadedmetadata", go, { once: true })
}

async function rendre() { rendreRail(); await rendrePanneau(); majLecteur() }

// ---------- Travail en cours et synchronisation avec l'IA ----------
let suivi
function suivreTravail() {
  clearInterval(suivi)
  suivi = setInterval(async () => {
    const t = await api("GET", "/api/travail").catch(() => null)
    if (!t) return
    const j = $("#journal")
    j.textContent = t.lignes?.length ? t.lignes.join("\n") : "Rien en cours."
    j.scrollTop = j.scrollHeight
    $("#travail-etat").textContent = t.en_cours ? `· ${t.action}…` : t.action ? `· ${t.action} ${t.code === 0 ? "terminé" : "en erreur"}` : ""
    if (S.travailAvant && !t.en_cours) {
      clearInterval(suivi)
      toast(t.code === 0 ? `${t.action} : terminé` : `${t.action} : erreur, lis le journal en bas`)
      S.style = null
      await toutCharger()
    }
    S.travailAvant = t.en_cours
    if (S.etat) S.etat.travail = { ...t, lignes: undefined }
  }, 1200)
}
setInterval(async () => {   // le montage a-t-il été changé par l'IA ?
  if (!S.id || S.enAttente || enCours() || document.activeElement?.matches("input, textarea, select")) return
  const v = await api("GET", `/api/videos/${S.id}`).catch(() => null)
  if (v && S.v && v.version !== S.v.version) { S.v = v; rendre(); toast("Montage mis à jour par ton IA") }
}, 4000)

// ---------- Barre du haut, dialogues ----------
$("#choix-video").onchange = async (e) => { S.id = e.target.value; localStorage.setItem("video", S.id); S.source = "apercu"; if (S.etape === "style" || S.etape === "outils") S.etape = "prises"; await chargerVideo(); rendre() }
$("#btn-style").onclick = () => { S.etape = "style"; rendre() }
$("#etat-outils").onclick = () => { S.etape = "outils"; rendre() }
document.querySelectorAll(".onglets-lecteur button").forEach((b) => (b.onclick = () => { S.source = b.dataset.source; if (S.etape === "style") S.etape = "prises"; rendre() }))
$("#btn-nouvelle").onclick = async () => {
  await chargerEtat()
  const sel = $("#nv-rush"); sel.replaceChildren(...(S.etat.rushs_libres.length ? S.etat.rushs_libres.map((f) => h("option", { value: f }, f)) : [h("option", { value: "" }, "Aucun rush libre dans a-monter")]))
  $("#dlg-nouvelle").showModal()
}
$("#nv-creer").onclick = async (e) => {
  e.preventDefault()
  try {
    const r = await api("POST", "/api/videos", { rush: $("#nv-rush").value, sujet: $("#nv-sujet").value, format: $("#nv-format").value || undefined })
    $("#dlg-nouvelle").close(); S.id = r.id; localStorage.setItem("video", r.id); S.etape = "prises"; await toutCharger(); toast("Vidéo créée. Étape suivante : Transcrire.")
  } catch (err) { toast(err.message) }
}
$("#btn-demande").onclick = async () => {
  if (!S.id) return toast("Choisis d'abord une vidéo")
  try {
    const r = await api("POST", `/api/videos/${S.id}/demande`, { texte: $("#demande").value })
    $("#demande").value = ""
    try { await navigator.clipboard.writeText(r.prompt); toast("Demande notée. Message copié : colle-le dans ton IA.") } catch { prompt("Copie ce message et colle-le dans ton IA :", r.prompt) }
  } catch (e) { toast(e.message) }
}

// ---------- Démarrage ----------
;(async () => {
  try {
    ;[S.kit, S.sons] = await Promise.all([api("GET", "/api/kit"), api("GET", "/api/sons")])
    await toutCharger()
    suivreTravail()
  } catch (e) { $("#panneau").replaceChildren(h("p", {}, `Le serveur ne répond pas : ${e.message}. Relance « npm run studio ».`)) }
})()
