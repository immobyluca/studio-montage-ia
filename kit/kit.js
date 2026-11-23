/*
 * Kit d'animations du studio. Chaque élément est une fonction (ctx, x) qui ajoute ses mouvements à la timeline.
 *   x = { type, debut, fin, place, params } (temps en secondes sur la frise de la vidéo montée)
 * Catalogue lisible (paramètres, exemples, quand l'utiliser) : kit/animations.json
 * Pour ajouter une animation : écris KIT["mon-type"] = (ctx, x) => { ... } ici, et décris-la dans animations.json.
 */
(function () {
  const KIT = {}
  const I = {
    point: '<circle cx="12" cy="12" r="3"/>',
    oeil: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="3"/><path d="M16.2 14.1c3.1.3 5.3 2.5 5.3 5.9"/>',
    pin: '<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/>',
    maison: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5h4v5"/>',
    cle: '<circle cx="7.5" cy="12" r="4"/><path d="M11.5 12H21M17.5 12v3.5M20.5 12v2.5"/>',
    euro: '<path d="M18 6.5A7 7 0 1 0 18 17.5"/><path d="M4 10h10M4 14h10"/>',
    etoile: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
    coche: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    croix: '<path d="M7 7l10 10M17 7 7 17"/>',
    message: '<path d="M4 5h16v11H9.5L4 20z"/>',
    loupe: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>',
    signet: '<path d="M6 3h12v18l-6-4.5L6 21z"/>',
    bas: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    droite: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    reel: '<rect x="3" y="3" width="18" height="18" rx="4.5"/><path d="M10 8.3v7.4l6.2-3.7z" fill="currentColor"/>',
    telephone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    calendrier: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    camera: '<rect x="2.5" y="6.5" width="14" height="11" rx="2.5"/><path d="M16.5 10.5 21.5 8v8l-5-2.5"/>',
    graphique: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    ampoule: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    batterie: '<rect x="2.5" y="7" width="17" height="10" rx="2.5"/><path d="M21.5 10.5v3"/><path d="M5.5 10v4"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="3"/>',
    cafe: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>',
    contrat: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  }
  const ico = (n) => `<span class="ico"><svg viewBox="0 0 24 24">${I[n] || I.point}</svg></span>`
  KIT.icones = Object.keys(I)

  // ---------- Outils communs ----------
  /** Zones utiles de l'image (évite le visage et l'interface d'Instagram). Réglables dans la charte. */
  function zones(D) {
    const V = D.hauteur > D.largeur
    const z = V
      ? { haut: { x: 110, y: 282, w: 860, h: 160 }, bas: { x: 145, y: 1010, w: 740, h: 540 }, centre: { x: 110, y: 520, w: 860, h: 900 } }
      : { haut: { x: 160, y: 70, w: 1600, h: 130 }, bas: { x: 130, y: 560, w: 760, h: 440 }, centre: { x: 360, y: 220, w: 1200, h: 640 } }
    return { ...z, ...(D.charte?.zones?.[V ? "vertical" : "horizontal"] ?? {}) }
  }
  function conteneur(ctx, x) {
    const c = A.mk('<div class="ill"></div>'); ctx.S.appendChild(c)
    ctx.tl.set(c, { visibility: "visible" }, Math.max(0, x.debut - 0.02)); ctx.tl.set(c, { visibility: "hidden" }, x.fin)
    return c
  }
  const IN = (ctx, el, t, o = {}) => A.entrer(ctx.tl, el, t, o)
  const sortie = (ctx, c, x) => A.sortir(ctx.tl, [...c.children], x.fin - 0.28)
  const allumer = (ctx, racine, t) => racine.querySelectorAll(".acc").forEach((a) => A.allumer(ctx.tl, a, t))
  /** Colonne centrée dans une zone. */
  function colonne(ctx, c, zone, largeur) {
    const Z = ctx.Z[zone] ?? ctx.Z.bas
    const w = Math.min(largeur ?? Z.w, Z.w)
    const col = A.mk(`<div class="col" style="left:${Z.x + (Z.w - w) / 2}px;top:${Z.y}px;width:${w}px"></div>`)
    c.appendChild(col); return col
  }
  const temps = (v, defaut) => (typeof v === "number" && Number.isFinite(v) ? v : defaut)
  const reparti = (n, a, b) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / Math.max(1, n))

  // ---------- 1. Titre d'accroche (lisible dès la 1re image) ----------
  function titre(ctx, T) {
    const { tl, S, W, V } = ctx
    const lignes = String(T.texte).split("\n").map((l) => `<span class="l titres">${A.acc(l)}</span>`).join("")
    const el = A.mk(`<div class="accroche ${T.style === "gros" ? "gros" : ""}"><div class="carte surface">${lignes}</div></div>`)
    S.appendChild(el)
    el.style.top = (T.y ?? (V ? 282 : 80)) + "px"
    const max = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--taille-accroche")) || 64
    el.querySelectorAll(".l").forEach((l) => A.ajuster(l, W - 220, max, 28))
    if ((T.debut ?? 0) <= 0.05) tl.set(el, { opacity: 1 }, 0)
    else IN(ctx, el.firstElementChild, T.debut, { dy: 18 })
    allumer(ctx, el, (T.debut ?? 0) + 0.3)
    A.sortir(tl, el.firstElementChild, T.fin - 0.3)
    tl.set(el, { visibility: "hidden" }, T.fin)
  }

  // ---------- 2. Sous-titres mot à mot ----------
  function sousTitres(ctx, MOTS, O) {
    const { tl, S, D } = ctx
    const maxMots = O.mots_max ?? 4, maxCar = O.caracteres_max ?? 24
    const caches = O.masquer ?? []
    const cache = (t) => caches.some(([a, b]) => t >= a - 0.02 && t < b)
    const finPhrase = (m) => /[.!?…]$/.test(m.texte)
    const groupes = []; let g = null
    MOTS.forEach((m, i) => {
      const prec = MOTS[i - 1], pause = prec ? m.debut - prec.fin : 9
      const trop = g && (g.mots.map((z) => z.texte).join(" ").length + 1 + m.texte.length) > maxCar
      if (!g || g.mots.length >= maxMots || trop || pause >= 0.15 || (prec && finPhrase(prec))) { g = { mots: [] }; groupes.push(g) }
      g.mots.push(m)
    })
    const inactif = A.couleur("--texte-inactif"), actif = A.couleur("--texte")
    groupes.forEach((g, i) => {
      g.debut = Math.max(0, g.mots[0].debut - 0.04)
      const s = groupes[i + 1], finMots = g.mots.at(-1).fin
      g.fin = s && s.mots[0].debut - finMots < 0.4 ? s.mots[0].debut - 0.04 : Math.min(finMots + 0.25, D.duree)
      // groupe caché (accroche, animation qui dit la même chose) : on le raccourcit ou on le saute
      for (const [a, b] of caches) { if (g.debut < a && g.fin > a) g.fin = a; if (g.debut >= a - 0.02 && g.debut < b) g.debut = Math.min(b, g.fin) }
      if (g.fin - g.debut < 0.12 || cache(g.debut)) return
      const el = A.mk('<div class="st-groupe"></div>'); el.style.top = O.y + "px"
      const carte = A.mk(`<div class="st-carte ${O.style ?? "pilule"}"></div>`)
      el.appendChild(carte); S.appendChild(el)
      tl.set(el, { visibility: "visible" }, g.debut); tl.set(el, { visibility: "hidden" }, g.fin)
      g.mots.forEach((m, k) => {
        const sp = document.createElement("span"); sp.className = "st-mot"; sp.textContent = A.fr(m.texte); carte.appendChild(sp)
        const suite = g.mots[k + 1] ? g.mots[k + 1].debut : g.fin
        tl.set(sp, { color: inactif }, 0)
        tl.set(sp, { color: actif }, k === 0 ? g.debut : m.debut)
        if (k < g.mots.length - 1) tl.set(sp, { color: inactif }, Math.max(m.fin, suite))
      })
    })
  }

  // ---------- 3. Bandeau (une ligne en haut, avec ou sans numéro) ----------
  KIT.bandeau = (ctx, x) => {
    const p = x.params ?? {}, c = conteneur(ctx, x), Z = ctx.Z.haut
    const b = A.mk(`<div class="bandeau" style="top:${Z.y}px"><div class="chip surface titres ${p.numero ? "" : "sans-num"}">${p.numero ? `<span class="num">${p.numero}</span>` : ""}<span>${A.acc(p.texte ?? "")}</span></div></div>`)
    c.appendChild(b); A.ajuster(b.querySelector(".chip > span:last-child"), Z.w - (p.numero ? 140 : 80), 42, 22)
    IN(ctx, b.firstElementChild, x.debut, { dy: -16 }); allumer(ctx, b, temps(p.t_accent, x.debut + 0.3))
    sortie(ctx, c, x)
  }

  // ---------- 4. Compteur ----------
  KIT.compteur = (ctx, x) => {
    const p = x.params ?? {}, c = conteneur(ctx, x)
    const de = Number(p.de ?? 0), a = Number(p.a ?? 100)
    const dec = Math.max((String(p.a).split(".")[1] ?? "").length, (String(p.de ?? 0).split(".")[1] ?? "").length)
    const f = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
    const txt = (v) => `${p.prefixe ?? ""}${f.format(v)}${p.suffixe ?? ""}`.replace(/\s/g, " ")
    const col = colonne(ctx, c, p.zone ?? "bas", 640)
    const carte = A.mk(`<div class="compteur surface"><div class="geant titres chiffres">${txt(de)}</div>${p.legende ? `<div class="legende titres">${A.acc(p.legende)}</div>` : ""}</div>`)
    col.appendChild(carte)
    // taille calculée sur le nombre le plus long (« 0 jours » puis « 21 jours » ne doit pas déborder)
    const g = carte.querySelector(".geant"); g.textContent = txt(Math.abs(a) >= Math.abs(de) ? a : de); A.ajuster(g, 500, 220, 60); g.textContent = txt(de)
    IN(ctx, carte, x.debut, { dy: 30, echelle: 0.94 })
    const au = temps(p.au, x.debut + 0.35), duree = Math.max(0.4, temps(p.duree_compte, Math.min(1.6, x.fin - au - 0.6)))
    const o = { v: de }
    ctx.tl.to(o, { v: a, duration: duree, ease: "power2.out", onUpdate: () => { g.textContent = txt(o.v) } }, au)
    ctx.tl.set(g, { textContent: txt(a) }, au + duree)
    A.insister(ctx.tl, g, au + duree, 1.1)
    allumer(ctx, carte, au + duree)
    sortie(ctx, c, x)
  }

  // ---------- 5. Liste 1-2-3 qui se défloute ----------
  KIT.liste = (ctx, x) => {
    const p = x.params ?? {}, c = conteneur(ctx, x)
    const els = p.elements ?? [], ouvert = Number(p.ouvert ?? 0)
    if (p.titre) {
      const Z = ctx.Z.haut
      const b = A.mk(`<div class="bandeau" style="top:${Z.y}px"><div class="chip surface titres sans-num"><span>${A.acc(p.titre)}</span></div></div>`)
      c.appendChild(b); IN(ctx, b.firstElementChild, x.debut, { dy: -16 }); allumer(ctx, b, x.debut + 0.3)
    }
    const col = colonne(ctx, c, p.zone ?? "bas", 740)
    const deflou = temps(p.deflou, x.debut + 0.45)
    els.forEach((texte, i) => {
      const n = i + 1, net = n < ouvert, actif = n === ouvert
      const el = A.mk(`<div class="tuile ${actif ? "surface-claire" : "surface"} titres"><span class="num">${n}</span><span class="txt">${A.acc(texte)}</span></div>`)
      col.appendChild(el); IN(ctx, el, x.debut + 0.1 + i * 0.08, { dy: 16 })
      const t = el.querySelector(".txt")
      if (net) return
      if (actif) {
        ctx.tl.fromTo(t, { filter: "blur(13px)", opacity: 0.5 }, { filter: "blur(0px)", opacity: 1, duration: 0.55, ease: "power2.out", immediateRender: true }, deflou)
        A.insister(ctx.tl, el, deflou, 1.05); allumer(ctx, el, deflou + 0.2)
      } else ctx.tl.set(t, { filter: "blur(13px)", opacity: 0.5 }, 0)
    })
    sortie(ctx, c, x)
  }

  // ---------- 6. Cartes qui arrivent sur les mots ----------
  KIT.cartes = (ctx, x) => {
    const p = x.params ?? {}, c = conteneur(ctx, x)
    const cartes = p.cartes ?? [], col = colonne(ctx, c, p.zone ?? "bas", 740)
    const ts = reparti(cartes.length, x.debut + 0.05, Math.max(x.debut + 0.1, x.fin - 1.2))
    cartes.forEach((k, i) => {
      const el = A.mk(`<div class="tuile ${k.claire ? "surface-claire" : "surface"} titres"><span class="t">${ico(k.icone)}</span><span>${k.petit ? `<span class="petit">${A.fr(k.petit)}</span>` : ""}${A.acc(k.texte ?? "")}</span></div>`)
      col.appendChild(el); const t = temps(k.t, ts[i]); IN(ctx, el, t, { dy: 18 }); allumer(ctx, el, t + 0.3)
    })
    sortie(ctx, c, x)
  }

  // ---------- 7. Pour / contre (coche et croix) ----------
  KIT["pour-contre"] = (ctx, x) => {
    const p = x.params ?? {}, c = conteneur(ctx, x), col = colonne(ctx, c, p.zone ?? "bas", 740)
    const tOui = temps(p.t_oui, x.debut + 0.05), tNon = temps(p.t_non, tOui + 0.8)
    const oui = A.mk(`<div class="tuile surface-claire titres"><span>${p.sous_oui ? `<span class="petit">${A.fr(p.sous_oui)}</span>` : ""}${A.acc(p.oui ?? "")}</span><span class="rond ok">${ico("coche")}</span></div>`)
    const non = A.mk(`<div class="tuile surface titres"><span style="position:relative">${p.sous_non ? `<span class="petit">${A.fr(p.sous_non)}</span>` : ""}${A.fr(p.non ?? "")}<span class="barre"></span></span><span class="rond non">${ico("croix")}</span></div>`)
    col.appendChild(oui); col.appendChild(non)
    IN(ctx, oui, tOui, { dy: 18 }); allumer(ctx, oui, tOui + 0.3); IN(ctx, non, tNon, { dy: 18 })
    ctx.tl.fromTo(non.querySelector(".barre"), { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: "power2.inOut", immediateRender: true }, tNon + 0.45)
    sortie(ctx, c, x)
  }

  // ---------- 8. Idée reçue barrée, puis la bonne idée ----------
  KIT.barre = (ctx, x) => {
    const p = x.params ?? {}, c = conteneur(ctx, x), col = colonne(ctx, c, p.zone ?? "bas", 740)
    const tB = temps(p.t_barre, x.debut + 0.9), tV = temps(p.t_vrai, tB + 0.45)
    const faux = A.mk(`<div class="tuile surface titres"><span style="position:relative"><span class="petit">${A.fr(p.sous_faux ?? "Ce qu'on croit")}</span><span class="txt">${A.fr(p.faux ?? "")}</span><span class="barre"></span></span></div>`)
    const vrai = A.mk(`<div class="tuile surface-claire titres"><span><span class="petit">${A.fr(p.sous_vrai ?? "En vrai")}</span>${A.acc(p.vrai ?? "")}</span></div>`)
    col.appendChild(faux); col.appendChild(vrai)
    IN(ctx, faux, x.debut, { dy: 18 })
    ctx.tl.fromTo(faux.querySelector(".barre"), { scaleX: 0 }, { scaleX: 1, duration: 0.35, ease: "power2.inOut", immediateRender: true }, tB)
    ctx.tl.to(faux.querySelector(".txt"), { opacity: 0.45, duration: 0.3 }, tB + 0.2)
    IN(ctx, vrai, tV, { dy: 18 }); allumer(ctx, vrai, tV + 0.35)
    sortie(ctx, c, x)
  }

  // ---------- 9. Image (photo d'un bien, capture) ----------
  KIT.image = (ctx, x) => {
    const p = x.params ?? {}, c = conteneur(ctx, x)
    if (!p.src) return
    const col = colonne(ctx, c, p.zone ?? "centre", p.largeur ?? 760)
    const el = A.mk(`<div class="surface" style="padding:14px;display:flex;flex-direction:column;gap:12px"><img src="${p.src}" style="width:100%;border-radius:calc(var(--arrondi) * 0.7);display:block;max-height:${(ctx.Z[p.zone ?? "centre"] ?? ctx.Z.centre).h - 120}px;object-fit:cover">${p.legende ? `<div class="titres" style="font-size:36px;padding:0 10px 6px">${A.acc(p.legende)}</div>` : ""}</div>`)
    col.appendChild(el); IN(ctx, el, x.debut, { dy: 26, echelle: 0.96 }); allumer(ctx, el, x.debut + 0.4)
    sortie(ctx, c, x)
  }

  // ---------- 10. Schéma plein écran : cercle d'étapes qui s'allument ----------
  KIT["schema-cercle"] = (ctx, x) => {
    const p = x.params ?? {}, c = conteneur(ctx, x), { W, H, V, tl } = ctx
    const v = A.mk('<div class="voile"></div>'); c.appendChild(v); A.fondu(tl, v, x.debut, 0, 1, 0.35)
    if (p.titre) { const ti = A.mk(`<div class="titre-schema titres" style="top:${V ? 300 : 70}px">${A.acc(p.titre)}</div>`); c.appendChild(ti); IN(ctx, ti, x.debut + 0.1); allumer(ctx, ti, x.debut + 0.5) }
    const et = p.etapes ?? [], cx = W / 2, cy = V ? H * 0.47 : H * 0.56, r = Math.min(W, H) * (V ? 0.29 : 0.3)
    const L = 2 * Math.PI * r, blanc = A.couleur("--texte")
    const svg = A.mk(`<svg class="abs" style="left:0;top:0" width="${W}" height="${H}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${blanc}" stroke-opacity=".16" stroke-width="12"/><circle class="arc" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${blanc}" stroke-width="12" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})" stroke-dasharray="${L}" stroke-dashoffset="${L}"/></svg>`)
    c.appendChild(svg); A.fondu(tl, svg, x.debut + 0.1, 0, 1, 0.4)
    const ts = reparti(et.length, x.debut + 0.7, x.fin - 0.6)
    const sc = A.couleur("--clair"), tc = A.couleur("--texte-clair")
    et.forEach((e, i) => {
      const ang = (-90 + (i * 360) / et.length) * Math.PI / 180
      const n = A.mk(`<div class="noeud" style="left:${cx + r * Math.cos(ang)}px;top:${cy + r * Math.sin(ang)}px"><div class="titres"><span class="t">${ico(e.icone)}</span>${A.fr(e.texte)}</div></div>`)
      c.appendChild(n); IN(ctx, n.firstElementChild, x.debut + 0.2 + i * 0.06, { dy: 10, flou: 6, d: 0.45 })
      const t = temps(e.t, ts[i])
      tl.to(n.firstElementChild, { backgroundColor: sc, color: tc, duration: 0.3, ease: "power2.out" }, t)
      tl.to(n.querySelector(".t"), { backgroundColor: tc, color: sc, duration: 0.3 }, t)
      A.insister(tl, n.firstElementChild, t, 1.1)
      tl.to(svg.querySelector(".arc"), { attr: { "stroke-dashoffset": L * (1 - (i + 1) / et.length) }, duration: 0.5, ease: "power2.inOut" }, t - 0.2)
    })
    sortie(ctx, c, x)
  }

  // ---------- 11. Schéma plein écran : étapes reliées par des flèches ----------
  KIT["schema-etapes"] = (ctx, x) => {
    const p = x.params ?? {}, c = conteneur(ctx, x), { W, H, V, tl } = ctx
    const v = A.mk('<div class="voile"></div>'); c.appendChild(v); A.fondu(tl, v, x.debut, 0, 1, 0.35)
    if (p.titre) { const ti = A.mk(`<div class="titre-schema titres" style="top:${V ? 300 : 70}px">${A.acc(p.titre)}</div>`); c.appendChild(ti); IN(ctx, ti, x.debut + 0.1); allumer(ctx, ti, x.debut + 0.5) }
    const et = p.etapes ?? [], w = Math.min(W - 160, 820)
    const col = A.mk(`<div class="col" style="left:${(W - w) / 2}px;top:${V ? 520 : 230}px;width:${w}px;gap:10px"></div>`); c.appendChild(col)
    const ts = reparti(et.length, x.debut + 0.5, x.fin - 0.7)
    et.forEach((e, i) => {
      const dernier = i === et.length - 1
      if (i > 0) { const f = A.mk(`<div class="fleche">${ico("bas")}</div>`); col.appendChild(f); IN(ctx, f, temps(e.t, ts[i]) - 0.15, { dy: -10, d: 0.4 }) }
      const el = A.mk(`<div class="etape ${dernier ? "surface-claire" : "surface"} titres">${e.icone ? `<span class="t" style="font-size:44px;display:inline-flex">${ico(e.icone)}</span>` : ""}<span>${A.acc(e.texte ?? "")}</span></div>`)
      col.appendChild(el); const t = temps(e.t, ts[i]); IN(ctx, el, t, { dy: 20 }); allumer(ctx, el, t + 0.3)
      if (dernier) A.insister(tl, el, t + 0.5, 1.05)
    })
    sortie(ctx, c, x)
  }

  // ---------- 12. Appel à l'action ----------
  KIT["appel-action"] = (ctx, x) => {
    const p = x.params ?? {}, c = conteneur(ctx, x), col = colonne(ctx, c, p.zone ?? "bas", 740)
    const el = A.mk(`<div class="cta surface titres"><span class="ico-grand">${ico(p.icone ?? "message")}</span><span class="grand">${A.acc(p.texte ?? "Dis-le en commentaire")}</span>${p.sous ? `<span class="petit" style="font-size:32px">${A.fr(p.sous)}</span>` : ""}</div>`)
    col.style.alignItems = "center"; col.appendChild(el)
    IN(ctx, el, x.debut, { dy: 24, echelle: 0.95 }); allumer(ctx, el, x.debut + 0.4)
    if (p.fleche !== false) {
      const f = A.mk(`<div class="fleche" style="font-size:72px">${ico("bas")}</div>`); col.appendChild(f)
      IN(ctx, f, x.debut + 0.5, { dy: -12 })
      const n = Math.max(1, Math.floor((x.fin - x.debut - 1.2) / 0.9))
      ctx.tl.to(f, { y: 14, duration: 0.45, ease: "sine.inOut", yoyo: true, repeat: n * 2 - 1, immediateRender: false }, x.debut + 1.1)
    }
    sortie(ctx, c, x)
  }

  // ---------- 13. Signature de fin (logo, nom, compte : mon-style/charte.json) ----------
  KIT.signature = (ctx, x) => {
    const p = x.params ?? {}, c = conteneur(ctx, x), { W, H, tl } = ctx, s = ctx.D.charte?.signature ?? {}
    const v = A.mk('<div class="voile"></div>'); c.appendChild(v); A.fondu(tl, v, x.debut, 0, 1, 0.35)
    const el = A.mk(`<div class="signature abs" style="left:0;width:${W}px;top:${H * 0.36}px">${ctx.D.logo ? `<img src="${ctx.D.logo}">` : ""}${s.nom ? `<div class="nom titres">${A.fr(s.nom)}</div>` : ""}${s.compte ? `<div class="compte">${A.fr(s.compte)}</div>` : ""}${p.texte ? `<div class="titres" style="font-size:42px;margin-top:20px">${A.acc(p.texte)}</div>` : ""}</div>`)
    c.appendChild(el); IN(ctx, [...el.children], x.debut + 0.15, { decalage: 0.12, dy: 20 }); allumer(ctx, el, x.debut + 0.8)
    sortie(ctx, c, x)
  }

  // ---------- Lancement ----------
  KIT.lancer = async (D) => {
    window.CHARTE = D.charte
    await A.polices()
    const S = document.getElementById("scene")
    if (D.fond) document.body.style.background = D.fond
    const ctx = { tl: gsap.timeline({ paused: true }), S, W: D.largeur, H: D.hauteur, V: D.hauteur > D.largeur, Z: zones(D), D }
    if (D.couche === "avant" && D.accroche?.texte) titre(ctx, D.accroche)
    for (const x of D.animations ?? []) {
      if (x.couche !== D.couche) continue
      if (!KIT[x.type]) { console.error(`Animation inconnue : ${x.type}`); continue }
      try { KIT[x.type](ctx, x) } catch (e) { console.error(`Animation ${x.type} (${x.debut} s) : ${e.message}`) }
    }
    if (D.couche === "avant" && D.sous_titres?.actif && D.mots?.length) sousTitres(ctx, D.mots, D.sous_titres)
    // étiquettes (galerie du kit seulement) : le nom de chaque animation en bas de l'image
    for (const e of D.etiquettes ?? []) {
      const el = A.mk(`<div class="abs" style="left:0;right:0;top:${D.hauteur - 260}px;text-align:center;font-size:30px;font-weight:600;color:rgba(255,255,255,.75);visibility:hidden">${A.fr(e.texte)}</div>`)
      S.appendChild(el); ctx.tl.set(el, { visibility: "visible" }, e.debut); ctx.tl.set(el, { visibility: "hidden" }, e.fin)
    }
    ctx.tl.set({}, {}, D.duree)
    A.fin(ctx.tl)
  }
  window.KIT = KIT
})()
