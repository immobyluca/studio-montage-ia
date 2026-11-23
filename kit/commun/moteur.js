/*
 * Moteur commun des animations du studio (HyperFrames + GSAP).
 * Tout est une timeline GSAP en pause, fonction pure du temps : le rendu est identique image par image.
 * Mouvements par défaut : entrée qui monte de 22 px en sortant d'un léger flou (expo.out), sortie courte
 * (0,25 s, power2.in), un décalage de 0,06 à 0,08 s entre les mots. Aucun rebond.
 * Les couleurs, polices et arrondis viennent de mon-style/charte.json (variables CSS dans style.css).
 */
(function () {
  const A = {}
  A.ENTREE = "expo.out"
  A.SORTIE = "power2.in"
  A.$ = (s) => (typeof s === "string" ? document.querySelector(s) : s)

  // Polices chargées avant toute mesure de texte
  A.polices = () => Promise.all([
    document.fonts.load('800 80px "Titres"'), document.fonts.load('600 40px "Texte"'), document.fonts.load('800 80px "Accent"'),
    document.fonts.ready,
  ]).catch(() => null)

  // Entrée : monte de dy px en sortant d'un flou, opacité 0 -> 1
  A.entrer = (tl, cibles, t, o = {}) => {
    const M = window.CHARTE?.mouvement ?? {}
    tl.fromTo(cibles,
      { opacity: 0, y: o.dy ?? M.montee ?? 22, x: o.dx ?? 0, scale: o.echelle ?? 1, filter: `blur(${o.flou ?? M.flou ?? 10}px)` },
      { opacity: 1, y: 0, x: 0, scale: 1, filter: "blur(0px)", duration: o.d ?? M.duree ?? 0.6, ease: o.ease ?? A.ENTREE, stagger: o.decalage ?? 0, immediateRender: true }, t)
    return t + (o.d ?? M.duree ?? 0.6)
  }
  // Sortie courte
  A.sortir = (tl, cibles, t, o = {}) => {
    tl.fromTo(cibles,
      { opacity: 1, y: 0, filter: "blur(0px)" },
      { opacity: 0, y: o.dy ?? -8, filter: `blur(${o.flou ?? 6}px)`, duration: o.d ?? 0.25, ease: A.SORTIE, stagger: o.decalage ?? 0, immediateRender: false }, t)
    return t + (o.d ?? 0.25)
  }
  A.fondu = (tl, cibles, t, de, a, d = 0.4) => {
    tl.fromTo(cibles, { opacity: de }, { opacity: a, duration: d, ease: "power1.out", immediateRender: de === 0 }, t)
    return t + d
  }
  // Petite impulsion d'insistance (agrandit puis revient, sans rebond)
  A.insister = (tl, el, t, force = 1.08) => {
    tl.fromTo(el, { scale: 1 }, { scale: force, duration: 0.16, yoyo: true, repeat: 1, ease: "power2.out", immediateRender: false }, t)
  }

  // Découpe un élément en mots (les enfants comme .acc restent entiers)
  A.mots = (el) => {
    el = A.$(el)
    const out = [], nodes = [...el.childNodes]
    el.textContent = ""
    for (const n of nodes) {
      if (n.nodeType === 3) {
        for (const p of n.textContent.split(/(\s+)/)) {
          if (!p) continue
          if (/^\s+$/.test(p)) { el.appendChild(document.createTextNode(p)); continue }
          const s = document.createElement("span"); s.className = "mot"; s.textContent = p; el.appendChild(s); out.push(s)
        }
      } else { n.classList.add("mot"); el.appendChild(n); out.push(n) }
    }
    return out
  }

  // Capsule d'accent : le fond apparaît au temps t (0,55 s), le texte prend la couleur sur accent
  A.allumer = (tl, el, t) => {
    el = A.$(el)
    let f = el.querySelector(":scope > .acc-fond")
    if (!f) { f = document.createElement("span"); f.className = "acc-fond"; el.prepend(f) }
    tl.fromTo(f, { opacity: 0, scaleX: 0.86, scaleY: 0.9 }, { opacity: 1, scaleX: 1, scaleY: 1, duration: 0.55, ease: A.ENTREE, immediateRender: true }, t)
    const avant = getComputedStyle(el.parentElement ?? el).color
    // la couleur sur capsule dépend de la carte (sombre ou claire) : on la lit sur l'élément lui-même
    const apres = getComputedStyle(el).getPropertyValue("--texte-accent").trim() || A.couleur("--texte-accent")
    tl.fromTo(el, { color: avant }, { color: apres, duration: 0.3, ease: "power1.out", immediateRender: true }, t)
    return t + 0.55
  }
  // Valeur d'une variable de la charte (GSAP ne sait pas animer « var(--x) »)
  A.couleur = (nom) => getComputedStyle(document.documentElement).getPropertyValue(nom).trim() || "#FFFFFF"

  // Taille de police pour tenir sur une ligne dans une largeur donnée
  A.ajuster = (el, largeur, max = 400, min = 16) => {
    el = A.$(el); el.style.whiteSpace = "nowrap"
    const disp = el.style.display; el.style.display = "inline-block"
    el.style.fontSize = "100px"
    const w = el.getBoundingClientRect().width || 1
    const s = Math.max(min, Math.min(max, (100 * largeur) / w))
    el.style.fontSize = s.toFixed(2) + "px"
    el.style.display = disp
    return s
  }
  // Espaces françaises : insécable avant ; ! ? et à l'intérieur des guillemets
  A.fr = (s) => String(s ?? "").replace(/ ?([;!?])/g, " $1").replace(/« ?/g, "« ").replace(/ ?»/g, " »")
  // *mot* devient une capsule d'accent
  A.acc = (s) => A.fr(s).replace(/\*([^*]+)\*/g, '<span class="acc"><span class="acc-fond"></span>$1</span>')
  A.mk = (html) => { const w = document.createElement("div"); w.innerHTML = String(html).trim(); return w.firstElementChild }

  // Enregistre la timeline pour HyperFrames
  A.fin = (tl, id = "main") => { window.__timelines = window.__timelines || {}; window.__timelines[id] = tl; return tl }
  window.A = A
})()
