# Studio de montage IA

Un studio de montage vidéo sur ton ordinateur, piloté par ton IA (Claude ou ChatGPT). Tu filmes au téléphone, ton IA fait le reste avec toi : coupes, reprises écartées, sous-titres mot à mot, titre d'accroche, zooms, animations à ton style, sons, rendu final.

- Mac et Windows.
- Tout reste sur ton ordinateur : la transcription aussi (Whisper). Rien n'est publié.
- Gratuit, sans abonnement, sans clé API.

## Installer

Le plus simple : copie le prompt de la page de téléchargement, colle-le dans Claude ou ChatGPT. Ton IA lit `CLAUDE.md` (ou `AGENTS.md`) et te guide pas à pas.

À la main : Node.js 22 ou plus, puis dans ce dossier :

```bash
npm install
node outils/installer.mjs
npm run studio
```

Le dashboard s'ouvre sur http://127.0.0.1:4320.

## Les dossiers

| Dossier | Ce qu'il contient |
|---|---|
| `a-monter/` | Tes vidéos brutes. Dépose-les ici. |
| `videos/` | Un dossier par montage (`montage.json`, transcription, aperçu, rendu). |
| `finies/` | Les vidéos terminées, prêtes à poster. |
| `mon-style/` | Ta charte (couleurs, polices, logo) : toutes les animations la suivent. |
| `kit/` | Les animations (HyperFrames + GSAP) et leur catalogue. |
| `sons/` | Des bruitages libres de droits (CC0). |
| `outils/` | Les outils de montage (Node). |
| `dashboard/` | Ton éditeur dans le navigateur. |
| `docs/` | La recette de montage. |

## Licences

Code sous licence MIT (`LICENSE`). Sons CC0, police Inter (OFL), GSAP (licence standard GreenSock), HyperFrames (Apache 2.0) : voir `LICENCES-TIERS.md`.
