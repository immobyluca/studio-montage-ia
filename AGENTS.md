# Manuel de l'IA : Studio de montage IA

Ce fichier est pour toi, l'IA (Claude, ChatGPT, Codex ou autre). Le même texte existe en `CLAUDE.md` et en `AGENTS.md`. Lis-le en entier avant d'agir.

**Où installer le studio : toujours sur le disque de l'ordinateur, dans Documents. Jamais sur un disque externe ni sur une clé USB**, même si tu as été lancé depuis l'un d'eux : sur ces disques (souvent en FAT32 ou exFAT), le téléchargement casse et les fichiers perdent leurs droits. Seuls les fichiers lourds des montages peuvent aller sur un disque externe (voir « Fichiers lourds » plus bas).

## Qui tu aides

Un agent immobilier qui fait des vidéos pour Instagram, TikTok ou YouTube. Il filme au téléphone et veut un montage propre : coupes, sous-titres, titre d'accroche, zooms, animations, sons. Il n'est pas informaticien.

- Parle français, tutoie-le, fais des phrases courtes. Pas de jargon : dis « le dossier », pas « le répertoire » ; « la fenêtre noire où on tape des commandes » la première fois que tu parles du Terminal.
- Une étape à la fois. Dis ce que tu vas faire, fais-le, dis ce que ça a donné.
- Tout tourne sur son ordinateur. Rien n'est publié, aucun compte n'est créé, rien n'est acheté sans qu'il le demande clairement.

## Ton mode de travail : à décider tout de suite

**Mode agent** : tu peux lancer des commandes toi-même (Claude Code, Claude avec accès au terminal, Codex, ChatGPT avec un agent local…). Tu installes, tu lances, tu vérifies, tu lui montres le résultat.

**Mode guidé** : tu es dans une simple conversation, sans accès à son ordinateur. Alors :
1. Demande-lui s'il est sur Mac ou Windows.
2. Explique comment ouvrir le Terminal (Mac : Cmd + Espace, tape « Terminal », Entrée) ou PowerShell (Windows : touche Windows, tape « PowerShell », Entrée). Sur un Mac tout neuf, la recherche peut mettre quelques secondes à trouver « Terminal » : qu'il attende, ou qu'il passe par Finder, Applications, Utilitaires, Terminal.
3. Donne UNE seule commande à la fois, dans un bloc de code, avec une phrase sur ce qu'elle fait.
4. Demande-lui de la coller (clic droit ou Cmd+V / Ctrl+V), d'appuyer sur Entrée, puis de te renvoyer ce qui s'affiche (copie du texte ou capture d'écran).
5. Lis la réponse avant de donner la suivante. Si ça a échoué, explique simplement et donne la correction.
6. Pour modifier un fichier (montage.json, charte.json), donne-lui le contenu complet à coller, ou mieux : dis-lui de passer par le dashboard, qui fait la même chose avec des boutons.
`node outils/installer.mjs --guide` affiche la liste des commandes d'installation pour son système, sans rien lancer.

Si tu ne sais pas dans quel mode tu es, essaie une commande sans risque (`node -v`). Si tu ne peux pas, tu es en mode guidé.

## 1. Installation (pas à pas)

Commence par dire : « Je vais installer ton studio de montage. Ça prend 10 à 20 minutes, surtout des téléchargements (jusqu'à 45 minutes sur un Mac neuf). Rien ne sera publié. »

### Étape 1 : les outils de base

| | Mac | Windows |
|---|---|---|
| Outils d'Apple (Mac seulement, À FAIRE EN PREMIER) | Vérifie avec `xcode-select -p` (un chemin s'affiche : déjà installé). Sinon : `xcode-select --install`, puis attends la FIN de l'installation (voir ci-dessous) avant de passer à Homebrew | (rien à faire) |
| Gestionnaire d'installation | Homebrew. Vérifie avec `brew -v`. S'il manque, l'agent doit lancer LUI-MÊME dans le Terminal (mot de passe demandé) : `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` puis suivre les 2 lignes « Next steps » qu'il affiche | winget (déjà présent sur Windows 10 et 11). Vérifie avec `winget -v`. S'il manque : installer « App Installer » depuis le Microsoft Store |
| Node.js 22 ou plus | `brew install node` | `winget install -e --id OpenJS.NodeJS.LTS` |
| Git | Déjà fourni par les outils d'Apple (vérifie avec `git --version`), sinon `brew install git` | `winget install -e --id Git.Git` |

**Sur un Mac neuf, préviens-le AVANT de lancer ces commandes.** Ce sont les trois blocages vus en test :
1. `xcode-select --install` ouvre une fenêtre d'Apple, souvent cachée derrière les autres. S'il ne la voit pas, qu'il clique sur la nouvelle icône apparue dans le Dock. Il clique sur « Installer », puis sur « Accepter ». Le téléchargement prend 10 à 30 minutes. Attends qu'il te dise que la fenêtre annonce la fin, puis vérifie avec `xcode-select -p`.
2. Si Homebrew affiche « Press any key when the installation has completed », c'est qu'il installe lui-même ces outils d'Apple. Il ne touche à rien tant que la fenêtre d'Apple n'a pas fini, sinon l'installation échoue plus loin. Ça n'arrive pas si le point 1 est fait avant.
3. Le mot de passe demandé est celui de sa session sur le Mac. Rien ne s'affiche pendant la saisie, c'est normal. Il n'est retenu que 5 minutes : s'il est redemandé, il le retape, rien n'est cassé. Juste après, Homebrew attend un appui sur Entrée (« Press RETURN ») : qu'il appuie tout de suite.

Si la fenêtre d'Apple répond que le logiciel « n'est pas disponible actuellement depuis le serveur de mise à jour », fais réessayer un peu plus tard. Si ça persiste, l'autre voie est de télécharger les « Command Line Tools » sur developer.apple.com, ce qui demande de se connecter avec son identifiant Apple : propose-la seulement s'il est d'accord, et ne lui fais jamais créer de compte.

Sur Windows, après chaque `winget install`, il faut FERMER puis rouvrir PowerShell pour que la nouvelle commande soit trouvée.
Vérifie : `node -v` (v22 ou plus) et `git --version`.

### Étape 2 : récupérer le studio

Dans Documents, sur le disque de l'ordinateur (pas sur un disque externe) :

Mac :
```bash
cd ~/Documents && git clone https://github.com/immobyluca/studio-montage-ia studio-montage-ia && cd studio-montage-ia
```
Windows (PowerShell) :
```powershell
cd $HOME\Documents; git clone https://github.com/immobyluca/studio-montage-ia studio-montage-ia; cd studio-montage-ia
```
Sans Git : sur la page GitHub, bouton « Code » puis « Download ZIP », dézipper dans Documents, renommer le dossier `studio-montage-ia`.

### Étape 3 : installer le reste

Dans le dossier du studio :
```bash
npm install
node outils/installer.mjs
```
Sur Windows, dans PowerShell, écris `npm.cmd` au lieu de `npm` (`npm.cmd install`, `npm.cmd run studio`) : PowerShell bloque souvent `npm` tout court (« l'exécution de scripts est désactivée »). Ne change pas la politique de sécurité de Windows pour ça.
`npm install` installe HyperFrames (le moteur des animations, environ 110 Mo). `installer.mjs` installe ffmpeg (coupes, son, rendu) et Whisper (transcription), télécharge le modèle de transcription (466 Mo) et le navigateur de rendu, puis affiche un bilan. Sur Windows, Whisper est téléchargé depuis la page officielle du projet whisper.cpp.

### Étape 4 : vérifier

```bash
node outils/verifier.mjs
```
Tout doit être coché (✓). Les lignes avec un point (·) sont des options. Si une ligne est en ✗, applique la commande indiquée sous la ligne, puis relance la vérification.

### Étape 5 : ouvrir le dashboard

```bash
npm run studio
```
(Windows : `npm.cmd run studio`.) Puis ouvre http://127.0.0.1:4320 dans le navigateur. Plus tard, il pourra double-cliquer sur `Ouvrir le studio.command` (Mac) ou `Ouvrir le studio.bat` (Windows). Si le Mac bloque le fichier : clic droit, Ouvrir.

## 2. Juste après l'installation : « Crée ton style »

Propose-le tout de suite, sans attendre qu'il le demande :
« Ton studio marche. On crée ton style ? Envoie-moi une capture de ton profil Instagram, ou tes couleurs et ton logo. Toutes tes animations le suivront. »
Suis la procédure de `mon-style/CREE-TON-STYLE.md`. Elle finit par la galerie (`node outils/galerie.mjs`) : toutes les animations avec son style, à lui montrer.

Ensuite, propose une vidéo d'essai : « Filme-toi 20 à 30 secondes au téléphone, en vertical, en disant 2 ou 3 phrases (tu peux te tromper et recommencer une phrase : on verra si le studio garde la bonne prise). Dépose la vidéo dans le dossier `a-monter`. »

## 3. Monter une vidéo

Les commandes ci-dessous, dans l'ordre. Le dashboard a les mêmes boutons : l'agent peut faire chaque étape lui-même, ou te demander de la faire.

1. **Créer la vidéo** : `node outils/nouvelle-video.mjs <fichier-dans-a-monter> --sujet "estimation"` → crée `videos/AAAA-MM-JJ_sujet/` avec `montage.json` (le montage), `brief.md` et `demandes.md`. Demande-lui ce qu'il veut dire, son accroche et son appel à l'action ; note-le dans `brief.md`.
2. **Transcrire** : `node outils/transcrire.mjs <video>` (1 à 2 minutes pour 8 minutes de rush). Mot à mot, sur son ordinateur.
3. **Couper** : `node outils/couper.mjs <video>` → propose les prises (✓ gardée, ✗ écartée, avec la raison). LIS toute la liste et compare-la au brief : enlève les idées dites deux fois sous deux formes différentes, garde l'humour et l'appel à l'action. Ajuste `garder` dans `montage.json` (ou fais-le cocher dans le dashboard).
4. **Texte** : écris le titre d'accroche (`accroche.texte`, 2 lignes au plus, un mot en `*capsule*`), corrige les mots mal entendus (`remplacements`).
5. **Premier aperçu** : `node outils/rendre.mjs <video> --apercu` (petit, rapide). Il écrit aussi `mots-montage.json` : les mots avec leur temps dans la vidéo montée.
6. **Animations** : choisis-les dans `kit/animations.json` (chaque entrée a un exemple prêt à copier). Place-les sur des mots (`"debut": "mot:mandat"`) pour qu'elles suivent les coupes.
7. **Aperçu + planche** : `node outils/rendre.mjs <video> --apercu` puis `node outils/images.mjs <video>` → `videos/<video>/planche.jpg`. Regarde la planche (si tu vois les images) : visage jamais caché, textes lisibles, rien sous l'interface d'Instagram. Montre l'aperçu à l'agent (`videos/<video>/apercu.mp4`) et demande ses retours.
8. **Rendu final** : `node outils/rendre.mjs <video>` → `videos/<video>/export/` et une copie dans `finies/`. Les contrôles (durée, volume -14 LUFS, taille) s'affichent à la fin. Rien n'est publié : c'est lui qui poste.

Les règles détaillées et testées (coupes, reprises, sous-titres, accroche, zooms, animations, sons, rendu) sont dans `docs/RECETTE-MONTAGE.md`. Lis-les avant ton premier montage. Le format complet de `montage.json` y est décrit.

**Option détourage** (animations derrière lui, fond flouté) : `node outils/detourer.mjs <video>`, puis `"place": "derriere"` sur les animations voulues. C'est long (1 à 3 minutes par 10 s de vidéo) et à refaire après chaque changement de coupes. Propose-le seulement quand le montage est presque fini.

**Fichiers lourds** : ils vont dans `videos/<video>/travail/`. Si son disque est presque plein (la vérification l'indique), mets-les sur un disque externe : variable `STUDIO_TRAVAIL=/chemin/du/disque` (Mac : `STUDIO_TRAVAIL="/Volumes/MonDisque" node outils/rendre.mjs …` ; Windows : `$env:STUDIO_TRAVAIL="E:\studio"` avant la commande). Sur un disque formaté en FAT32, un fichier ne peut pas dépasser 4 Go : reste sous 90 s de vidéo par rendu.

## 4. Le dashboard et toi

Le dashboard (`npm run studio`) et toi travaillez sur les mêmes fichiers. Quand tu modifies `montage.json`, le dashboard se met à jour tout seul. Quand l'agent coche une prise ou change un texte dans le dashboard, c'est écrit dans `montage.json`.

- **Demandes** : le bloc « Demander à mon IA » écrit dans `videos/<video>/demandes.md` (une ligne `- [ ]` par demande) et copie un message à te coller. Au début de chaque session, et quand il te le dit, lis les demandes non cochées, applique-les, relance l'aperçu, coche la ligne (`- [x]`) et dis ce que tu as changé.
- **Un seul écrivain à la fois** : ne modifie pas `montage.json` pendant qu'un rendu lancé depuis le dashboard tourne (le bloc « Travail en cours » l'indique).
- `journal.txt` dans chaque vidéo garde la trace de ce que le dashboard a lancé.

## 5. Faire évoluer le studio

Il pourra te demander d'ajouter des choses. Fais-le proprement :
- **Une nouvelle animation** : ajoute une fonction `KIT["mon-type"] = (ctx, x) => { … }` dans `kit/kit.js` (copie une animation proche), décris-la dans `kit/animations.json` (nom, quand, place, paramètres, exemple), puis vérifie-la avec `node outils/galerie.mjs`. Les couleurs et polices viennent toujours des variables de la charte (`var(--accent)`…), jamais en dur.
- **Le dashboard** : `dashboard/public/` (HTML, CSS, JavaScript simples, sans compilation). Recharge la page après une modification. Ses couleurs sont dans les variables en haut de `style.css`.
- **Un réglage de montage** : les outils sont dans `outils/` (Node, commentés en français). Garde-les compatibles Mac ET Windows : chemins avec `path.join`, pas de commande propre à un système sans équivalent.
- Après une modification, refais un aperçu sur une vidéo existante pour vérifier que rien n'est cassé.
- Une option avec une clé API (Claude, OpenAI) n'est jamais obligatoire. Si l'agent en veut une, la clé va dans un fichier `.env` (déjà ignoré par Git), jamais dans le code, jamais dans un message.

## 6. Dépannage

| Problème | Solution |
|---|---|
| `node` ou `ffmpeg` introuvable sur Windows juste après l'installation | Fermer et rouvrir PowerShell |
| Windows : « l'exécution de scripts est désactivée » en tapant `npm` | Utiliser `npm.cmd` à la place de `npm` (ou double-cliquer sur `Ouvrir le studio.bat`) |
| Mac : l'installation de Homebrew échoue, ou `git` est introuvable | Vérifier `xcode-select -p`. Si rien ne s'affiche, refaire le point 1 de l'étape 1 (outils d'Apple) jusqu'au bout, puis relancer Homebrew |
| `npm install` refuse (droits) sur Mac | Ne jamais utiliser `sudo` : vérifier que le studio est dans Documents, pas dans un dossier système |
| La transcription échoue | `node outils/verifier.mjs` ; sur Mac `brew install whisper-cpp` ; sur Windows `node outils/installer.mjs` |
| Aucune parole détectée | Le son du rush est très bas : `node outils/transcrire.mjs <video> --seuil -55` |
| Des mots mal entendus | `remplacements` dans `montage.json`, ou `--modele medium` (plus lent, plus précis) |
| Le rendu des calques échoue | `node node_modules/hyperframes/bin/hyperframes.mjs doctor`, puis `node node_modules/hyperframes/bin/hyperframes.mjs browser ensure` |
| Couleurs délavées (vidéo HDR d'iPhone) | ffmpeg sans « zscale » : `brew reinstall ffmpeg` (Mac) ou `winget install -e --id Gyan.FFmpeg` (Windows) ; ou filmer en SDR (Réglages iPhone, Appareil photo, Formats, Vidéo HDR désactivée) |
| Le dashboard ne s'ouvre pas | Il tourne peut-être déjà : ouvrir http://127.0.0.1:4320 |
| Disque plein | `STUDIO_TRAVAIL` vers un disque externe ; supprimer les dossiers `travail/` des vidéos finies (pas les rushs) |

## 7. Règles fermes

- **Ne supprime jamais un rush** (`a-monter/` ou ailleurs) ni une vidéo finie. Pour faire de la place, seuls les dossiers `videos/<video>/travail/` peuvent être vidés, et seulement après accord.
- **Rien n'est publié** sur Instagram, TikTok, YouTube ou ailleurs. Aucun compte, achat ou abonnement sans demande claire de l'agent.
- **Droits** : seulement des sons libres (le dossier `sons/` est en CC0), des polices libres (OFL), des images et musiques qu'il a le droit d'utiliser. En cas de doute, dis-le.
- **Ses données restent chez lui** : ne copie jamais ses vidéos, sa voix ou ses textes vers un service en ligne sans son accord.
- **Le style de l'agent gagne** sur ton goût. Tu peux conseiller, il décide.
- **Une chose à la fois** : un changement, un aperçu, son avis.
- Quand il te corrige avec « toujours », « jamais » ou « la prochaine fois », propose d'écrire la règle dans `mon-style/charte.md`, et relis ce fichier au début des sessions suivantes.
