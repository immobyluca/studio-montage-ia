# Recette de montage (consignes testées)

Ces règles viennent de vrais montages de Reels, vérifiés image par image. Les outils les appliquent déjà par défaut ; toi (l'IA), tu les fais respecter quand tu ajustes à la main. Si l'agent demande autre chose, son choix passe avant.

## 1. Coupes

**Ce que fait `couper.mjs`**
- `transcrire.mjs` repère les passages parlés au son (un silence = 0,45 s ou plus sous un seuil calé sur sa voix). Voix basse dans une pièce bruyante : chaque passage de plus de 5 s est revérifié avec un seuil 6 dB plus haut, pour que deux reprises ne restent pas collées. Les bruits (chaise, porte, souffle, 20 dB sous la voix) et les « Merci. » inventés par Whisper sont ignorés. Une coupe tombe toujours dans un silence, **jamais entre deux mots**.
- Au rendu, il laisse **0,06 s avant** le premier son et **0,08 s après** le dernier : au moins 120 ms d'air entre deux phrases. Les pauses courtes à l'intérieur d'une phrase (respirations) sont gardées.
- **Reprises** : deux prises proches sont des reprises quand elles commencent par les mêmes mots (« donc », « et », « alors » au début ne comptent pas), ou quand elles disent la même idée autrement (au moins 3 mots de sens en commun). Il garde la **dernière prise complète**. C'est en général la plus fluide : l'agent s'est corrigé. Une phrase qui recommence au milieu d'un passage (« Pour faire ça… Pour faire ça, je vous ai créé… ») est coupée en deux avant le choix.
- Il écarte aussi les « euh » seuls, les consignes de tournage (« je recommence », « attends »), les sons très courts (moins de 0,5 s), les phrases abandonnées (« Vous allez… ») et les bouts de phrase déjà dits en entier dans une prise gardée juste à côté.
- Testé sur deux vrais rushs à voix basse (6 et 8 min, plus de 50 reprises chacun) : les prises gardées sont celles qu'un monteur avait choisies à la main, à 2 ou 3 doublons près sur le rush de 8 min.

**Ce que TU dois vérifier** (l'outil ne peut pas le deviner)
1. Lis toute la liste avec le brief sous les yeux.
2. Une même idée dite sous deux formes très différentes peut encore passer (« Déjà, les trends, il ne faut pas… » puis « Déjà premièrement, des trends tu peux en faire… »). Choisis-en une (la plus claire, ou celle qui colle au script). Vérifie aussi qu'une prise écartée comme « reprise » ne contenait pas une idée absente de la prise gardée.
3. Garde toujours l'humour et l'appel à l'action de la fin.
4. Choix entre plusieurs bonnes prises : par défaut la dernière. `node outils/couper.mjs <video> --choix energie` garde la plus énergique (volume moyen de la voix). Si l'agent hésite, propose d'écouter : dans le dashboard, un clic sur une prise la joue.
5. Durée : 30 à 60 s pour un Reel, 90 s au maximum. Au-delà, propose ce qu'on peut enlever.

**Recoller une phrase** (début d'une prise + fin d'une autre)
- Dans `transcription.json`, chaque mot a son `debut` et sa `fin` (en secondes dans le rush).
- Ajoute une prise à la main dans `montage.json` → `prises`, avec `debut`/`fin` pris sur les mots : `fin` = fin du dernier mot gardé + 0,02 ; `debut` de la suite = début du premier mot repris - 0,02. Choisis un endroit où il y a un petit creux entre deux mots (0,08 s ou plus).
- Mets `"morceaux": [[debut, fin]]` avec les mêmes valeurs, ou supprime `morceaux`.
- Fais écouter le résultat à l'agent : un recollage s'entend parfois.

## 2. Sous-titres mot à mot

- 4 mots au plus par groupe, 24 caractères au plus. Un nouveau groupe après un point ou une pause.
- Le mot prononcé est en plein, les autres atténués.
- Position : sous le visage, au-dessus de la zone de légende d'Instagram (y 1234 sur 1920 en vertical). Jamais sur le visage.
- Cachés pendant le titre d'accroche, et pendant les animations qui disent la même chose (compteur, liste, cartes, schémas : réglé par défaut).
- Mots mal entendus (noms de villes, marques, anglicismes : « trains » pour « trends ») : `"remplacements": { "trains": "trends" }` dans `montage.json`. Ça corrige tous les sous-titres d'un coup.

## 3. Titre d'accroche

- Lisible **dès la première image** (pas d'animation d'entrée) : sur Instagram, la vidéo démarre en silence pour beaucoup de gens.
- 2 à 3 secondes, souvent jusqu'à la fin de la première phrase (`"fin": "mot:dernier-mot"`).
- 2 lignes au plus (retour à la ligne : `\n`), un seul mot en capsule (`*mot*`).
- Au-dessus de la tête (y 282). Sur la planche d'images, vérifie qu'il ne touche pas les cheveux ; sinon baisse le texte (`"style": "gros"`) ou monte un peu `y`, sans passer au-dessus de y 270 (interface d'Instagram).
- Le titre doit promettre ce que la vidéo tient. Pas d'accroche générique (« Les conseils immo du jour ») : une tension précise (« Ton estimation est *fausse* »).

## 4. Zooms

- Zoom alterné à chaque coupe : 100 %, puis 115 %, puis 100 %… Il cache les sauts d'image entre deux prises.
- Zoom d'élan sur l'accroche : 100 % → 112 % en 0,45 s, puis poussée lente jusqu'à 116 %.
- Le zoom est ancré dans le haut de l'image (`"ancre": [0.5, 0.3]`) : la tête ne sort pas du cadre. Si l'agent est filmé de loin ou décalé, ajuste l'ancre (0 = gauche/haut, 1 = droite/bas).
- Un morceau de moins de 0,8 s garde le zoom d'avant (sinon ça clignote).
- Pour couper les zooms : `"zooms": { "actif": false }`.

## 5. Animations

- **Une seule chose bouge à la fois.** Pas deux animations en même temps (le rendu prévient s'il y a un chevauchement).
- Chaque animation reste au moins **1,2 s** (2 à 4 s, c'est mieux) : il faut le temps de lire.
- **Jamais sur le visage.** Le bandeau va en haut (au-dessus de la tête). Compteur, liste, cartes, pour/contre, barré : sous le visage (zone y 1010 à 1550). Les schémas sont en plein écran (vidéo floutée et assombrie).
- Rien sous l'interface d'Instagram : pas en dessous de y 1580, pas dans le coin bas droit (x > 900 et y > 900).
- Place-les sur les mots, pas sur des secondes : `"debut": "mot:mandat"`. Elles suivent alors les changements de coupes. Les mots et leur temps sont dans `videos/<video>/mots-montage.json` (écrit à chaque aperçu). Un mot répété : `"mot:mandat@12"` (le premier après 12 s). Un décalage : `"mot:mandat-0.2"`.
- Rythme : une animation toutes les 4 à 8 s au plus, sur les idées clés. Une vidéo de 45 s en a souvent 4 à 6.
- Une liste « 3 choses » : annonce-la avec `"ouvert": 0` (tout flou), puis remets-la au début de chaque point avec `"ouvert": 1`, `2`, `3` (le point dit se défloute), suivie de l'animation du point.
- `"place": "derriere"` seulement avec le détourage (sinon l'animation passe devant).
- Avant le rendu final : `node outils/images.mjs <video>` et regarde chaque animation sur la planche.

## 6. Sons

- Un son discret à l'entrée de chaque animation (automatique, sons choisis dans la charte). Pas plus : trop de bruitages fatiguent.
- Un accent (validation, impact) sur 3 à 5 moments clés au plus.
- Rien pendant le titre d'accroche, sauf le souffle du zoom d'élan.
- Le mix est ramené à **-14 LUFS** (volume des réseaux), crête sous -1 dB. Une musique de fond reste à -26 dB sous la voix, et seulement si l'agent a le droit de l'utiliser.
- Rush trop bas (le rendu affiche « voix à -34 LUFS ») : le rendu remonte la voix, mais conseille de monter le gain du micro au prochain tournage.

## 7. Rendu final

1. Aperçu (`--apercu`), planche d'images, retours de l'agent. Une chose à la fois.
2. Rendu final : 1080x1920 (ou 1920x1080), 30 images par seconde, H.264, son AAC. Les vidéos HDR de l'iPhone sont converties en couleurs normales (SDR).
3. Les contrôles s'affichent à la fin (durée, image, volume). S'il y a « À VÉRIFIER », dis-le et explique.
4. Le fichier est dans `videos/<video>/export/` et une copie dans `finies/`. Rien n'est publié.

## Format de `montage.json`

```json
{
  "titre": "Estimation",
  "format": "9:16",
  "rush": "a-monter/IMG_1234.MOV",
  "prises": [
    { "id": 1, "texte": "Ton estimation est fausse.", "debut": 12.31, "fin": 14.02, "morceaux": [[12.31, 14.02]], "garder": true, "raison": "" }
  ],
  "accroche": { "texte": "Ton estimation\nest *fausse*", "debut": 0, "fin": "fin:fausse+0.2", "style": "carte" },
  "sous_titres": { "actif": true, "masquer_pendant_accroche": true },
  "remplacements": { "trains": "trends" },
  "zooms": { "actif": true, "motif": [1, 1.15], "ancre": [0.5, 0.3], "accroche": true, "duree_min": 0.8 },
  "animations": [
    { "type": "compteur", "debut": "mot:vendu", "fin": "fin:jours+0.6", "params": { "de": 0, "a": 21, "suffixe": " jours", "legende": "pour *vendre*" } }
  ],
  "sons": [ { "fichier": "sons/validation_verre.wav", "t": "mot:signé", "volume": -16 } ],
  "sons_auto": true,
  "musique": { "fichier": null, "volume": -26 },
  "detourage": false,
  "rendu": { "lufs": -14 },
  "reglages_coupes": { "marge_avant": 0.06, "marge_apres": 0.08, "choix": "derniere" }
}
```

- Temps des `prises` : en secondes **dans le rush**. Temps de l'accroche, des animations et des sons : en secondes **dans la vidéo montée**, ou repères sur les mots (`mot:…`, `fin:…`, `fin`, `fin-2.5`).
- Les paramètres de chaque animation et un exemple prêt à copier : `kit/animations.json`.
- Après une modification à la main, vérifie que le fichier est un JSON valide (le dashboard affiche une erreur sinon).
