# Crée ton style (procédure pour l'IA)

But : que TOUTES les animations (titre d'accroche, sous-titres, cartes, compteur, schémas, signature) aient l'allure de l'agent, en 10 minutes. Tout se règle dans un seul fichier : `mon-style/charte.json`. Les animations le lisent à chaque rendu.

Propose-le juste après l'installation, avec une phrase simple :
« Ton studio marche. On crée ton style maintenant ? Envoie-moi une capture d'écran de ton profil Instagram (la grille de tes publications), ou dis-moi tes couleurs et envoie ton logo. »

## 1. Récupérer la matière

L'agent choisit UNE des deux voies.

**A. Capture de son Instagram** (le plus simple)
- Demande une capture de son profil (grille visible) et, s'il en a, une capture d'une de ses publications avec du texte.
- Si tu vois les images, regarde : couleurs dominantes, couleur des textes, couleur d'accent (celle qui attire l'œil), style des lettres (bâton, serif, manuscrit, très gras ou fin), coins arrondis ou carrés, ambiance (sobre, chaleureuse, luxe, dynamique).
- Si l'agent a déposé la capture dans le studio, tu peux aussi mesurer les couleurs :
  `node outils/style.mjs couleurs mon-style/capture.png`

**B. Ses couleurs et son logo**
- Demande 2 ou 3 couleurs (un nom suffit : « bleu marine, doré, blanc » ; tu les convertis en #RRGGBB).
- Demande son logo, de préférence en PNG à fond transparent. Range-le dans `mon-style/logo/logo.png`.
- Demande son nom tel qu'il veut l'afficher et son compte (ex. `@son.compte`).

Ne demande jamais de mot de passe ni d'accès à son compte. Une capture suffit.

## 2. Écrire la charte

Modifie `mon-style/charte.json` (garde la même structure, change les valeurs) :

| Champ | Ce que c'est | Conseil |
|---|---|---|
| `nom` | Nom du style | « Style de Prénom » |
| `couleurs.surface` | Fond des cartes et des sous-titres | Sa couleur la plus foncée (ou la plus présente) |
| `couleurs.texte` | Texte posé sur les cartes | Blanc ou crème si la surface est foncée |
| `couleurs.accent` | Capsule du mot clé (*mot*) | Sa couleur signature, celle qui attire l'œil |
| `couleurs.texte_accent` | Texte dans la capsule | Contraste fort avec l'accent |
| `couleurs.clair`, `texte_clair` | Carte mise en avant (bon choix, point ouvert d'une liste, dernière étape) | Souvent l'inverse de la surface |
| `couleurs.attention`, `texte_attention` | Trait qui barre, croix | Peut rester neutre ; un rouge si son style l'accepte |
| `polices.*.fichier` | Police (fichier .ttf ou .otf dans le studio) | Voir plus bas |
| `formes.arrondi` | Coins en pixels | 0 à 8 pour un style carré, 24 à 36 pour un style doux |
| `sous_titres.style` | `pilule`, `contour` ou `simple` | `pilule` est le plus lisible sur toute vidéo |
| `signature.nom`, `signature.compte` | Signature de fin | Ce que l'agent t'a donné |
| `logo` | Chemin du logo | `mon-style/logo/logo.png` |
| `sons.*` | Son de chaque rôle (entrée, texte, validation…) | Fichiers du dossier `sons/` |

**Polices.** N'utilise que des polices gratuites et libres (licence SIL OFL, la plupart des Google Fonts). Si tu peux lancer des commandes, télécharge le fichier .ttf depuis le dépôt officiel Google Fonts (github.com/google/fonts, dossier `ofl/<nom>/`) avec son fichier `OFL.txt`, et range les deux dans `mon-style/polices/`. Sinon, garde Inter (déjà incluse) et dis-lui comment ajouter la sienne plus tard. Ne copie jamais une police payante ou une police installée avec ton système (souvent non redistribuable) dans le studio.
Correspondances simples : style bâton moderne → Inter, Manrope, Plus Jakarta Sans ; très gras et impactant → Anton, Bebas Neue ; élégant → Playfair Display, Fraunces (en accent seulement) ; arrondi et chaleureux → Nunito, Quicksand.

## 3. Vérifier et montrer

1. `node outils/style.mjs verifier` : il refuse un texte illisible (contraste sous 4,5). Corrige avant d'aller plus loin.
2. `node outils/galerie.mjs` : rend toutes les animations avec son style dans `mon-style/galerie.mp4` et une planche `mon-style/galerie.jpg`. Regarde la planche toi-même (si tu vois les images), puis montre-la : « Voici ton style sur toutes les animations. Qu'est-ce que tu changerais ? »
3. Ajuste selon ses retours (une chose à la fois), relance la galerie.
4. Écris en quelques lignes dans `mon-style/charte.md` ce qui a été choisi et pourquoi (pour les prochaines sessions).

Dans le dashboard, l'onglet « Mon style » montre les mêmes réglages et la galerie.

## Règles

- Une seule couleur d'accent, un seul mot en capsule par animation.
- Le texte doit rester lisible sur un téléphone, au soleil : contraste d'abord, goût ensuite.
- Le style de l'agent gagne toujours sur ton goût. Si un choix nuit à la lisibilité, dis-le simplement et propose une variante.
- Ne mets dans le studio aucune image ni police dont l'agent n'a pas les droits.
