// Installe ce qui manque, sur Mac (Homebrew) ou Windows (winget). Rien n'est installé sans être affiché avant.
// Usage : node outils/installer.mjs            installe et vérifie
//         node outils/installer.mjs --guide    affiche seulement les commandes, une par une (mode guidé)
//         node outils/installer.mjs --sans-modele   ne télécharge pas tout de suite le modèle de transcription
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DOSSIERS, MAC, RACINE, WIN, args, dossierModeles, ffmpeg, ffmpegChemin, hyperframes, hyperframesChemin, whisperChemin } from "./lib/commun.mjs"
import { verifier } from "./verifier.mjs"

const a = args()
const guide = Boolean(a.guide)
const dire = (t) => console.log(t)
const existe = (prog) => spawnSync(WIN ? "where" : "which", [prog], { encoding: "utf8" }).status === 0
  || (!WIN && ["/opt/homebrew/bin", "/usr/local/bin"].some((p) => existsSync(join(p, prog))))
const brew = () => (existsSync("/opt/homebrew/bin/brew") ? "/opt/homebrew/bin/brew" : existsSync("/usr/local/bin/brew") ? "/usr/local/bin/brew" : existe("brew") ? "brew" : null)

function executer(titre, prog, argv, o = {}) {
  dire(`\n→ ${titre}\n  ${[prog, ...argv].join(" ")}`)
  if (guide) return true
  const r = spawnSync(prog, argv, { stdio: "inherit", cwd: RACINE, shell: o.shell ?? false })
  if (r.status !== 0) dire(`  (échec, code ${r.status}) ${o.aide ?? ""}`)
  return r.status === 0
}

async function whisperWindows() {
  dire("\n→ Whisper pour Windows : téléchargement de whisper-bin-x64.zip (version officielle, github.com/ggml-org/whisper.cpp)")
  if (guide) { dire("  Télécharge whisper-bin-x64.zip depuis https://github.com/ggml-org/whisper.cpp/releases/latest et dézippe-le dans outils\\.bin\\whisper"); return }
  const rel = await fetch("https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest", { headers: { "User-Agent": "studio-montage-ia", Accept: "application/vnd.github+json" } }).then((r) => r.json())
  const asset = rel.assets?.find((x) => x.name === "whisper-bin-x64.zip")
  if (!asset) { dire("  Fichier introuvable dans la dernière version. Télécharge-le à la main (lien ci-dessus) et dézippe-le dans outils\\.bin\\whisper"); return }
  mkdirSync(join(DOSSIERS.bin, "whisper"), { recursive: true })
  const zip = join(DOSSIERS.bin, "whisper.zip")
  const buf = Buffer.from(await (await fetch(asset.browser_download_url, { headers: { "User-Agent": "studio-montage-ia" } })).arrayBuffer())
  writeFileSync(zip, buf)
  const r = spawnSync("tar", ["-xf", zip, "-C", join(DOSSIERS.bin, "whisper")], { stdio: "inherit" })
  rmSync(zip, { force: true })
  dire(r.status === 0 && whisperChemin() ? `  OK (${rel.tag_name})` : "  Dézippage impossible : dézippe whisper-bin-x64.zip à la main dans outils\\.bin\\whisper")
}

dire(`Installation du studio de montage IA (${MAC ? "Mac" : WIN ? "Windows" : process.platform})${guide ? " : MODE GUIDÉ, rien n'est lancé" : ""}`)

// Mode guidé : toute la marche à suivre pour ce système, avec ce qui est déjà fait (✓) ou à faire (→)
if (guide) {
  const ok = Object.fromEntries(verifier().map((x) => [x.id, x.ok]))
  const etapes = MAC ? [
    [Boolean(brew()), "Homebrew (à lancer par toi, il demande ton mot de passe)", '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'],
    [ok.node, "Node.js", "brew install node"],
    [ok.git, "Git", "brew install git"],
    [ok.ffmpeg, "ffmpeg", "brew install ffmpeg"],
    [ok.whisper, "Whisper", "brew install whisper-cpp"],
  ] : WIN ? [
    [ok.node, "Node.js (puis ferme et rouvre PowerShell)", "winget install -e --id OpenJS.NodeJS.LTS"],
    [ok.git, "Git", "winget install -e --id Git.Git"],
    [ok.ffmpeg, "ffmpeg (puis ferme et rouvre PowerShell)", "winget install -e --id Gyan.FFmpeg"],
  ] : [[ok.ffmpeg, "ffmpeg", "sudo apt install ffmpeg git"]]
  etapes.push(
    [ok.hyperframes, "HyperFrames (dans le dossier du studio)", WIN ? "npm.cmd install" : "npm install"],
    [ok.whisper && ok.modele && ok.chrome, `${WIN ? "Whisper, " : ""}modèle de transcription et navigateur de rendu`, "node outils/installer.mjs"],
    [false, "Vérification finale (tout doit être coché)", "node outils/verifier.mjs"],
    [false, "Ouvrir le dashboard (http://127.0.0.1:4320)", WIN ? "npm.cmd run studio (ou double-clic sur Ouvrir le studio.bat)" : "npm run studio"],
  )
  etapes.forEach(([fait, nom, cmd], i) => dire(`\n${i + 1}. ${fait ? "✓ déjà fait" : "→ à faire"} : ${nom}\n   ${cmd}`))
  dire("\nUne commande à la fois : colle-la, appuie sur Entrée, et renvoie le résultat à ton IA.")
  process.exit(0)
}

// 1. Node
if (Number(process.versions.node.split(".")[0]) < 22) {
  dire(`\nNode.js ${process.versions.node} est trop ancien (22 ou plus).\n  ${MAC ? "brew install node" : WIN ? "winget install -e --id OpenJS.NodeJS.LTS" : "voir https://nodejs.org"}\nPuis ferme et rouvre le terminal, et relance cette commande.`)
  process.exit(1)
}

// 2. HyperFrames (dépendance du dossier)
if (!hyperframesChemin()) executer("HyperFrames (animations, détourage, transcription)", WIN ? "npm.cmd" : "npm", ["install", "--no-fund", "--no-audit"], { shell: WIN })

// 3. ffmpeg et 4. Whisper
if (MAC) {
  const b = brew()
  if (!b && (!ffmpegChemin() || !whisperChemin())) {
    dire(`\nHomebrew (l'installateur d'outils du Mac) n'est pas installé. Il demande ton mot de passe : lance-le TOI-MÊME dans l'app Terminal :\n  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"\nPuis relance : node outils/installer.mjs`)
    process.exit(1)
  }
  if (!ffmpegChemin()) executer("ffmpeg (coupes, son, rendu)", b, ["install", "ffmpeg"])
  if (!whisperChemin()) executer("Whisper (transcription locale)", b, ["install", "whisper-cpp"])
} else if (WIN) {
  const winget = existe("winget")
  if (!ffmpegChemin()) {
    if (winget) executer("ffmpeg (coupes, son, rendu)", "winget", ["install", "-e", "--id", "Gyan.FFmpeg", "--accept-source-agreements", "--accept-package-agreements"],
      { aide: "Si winget échoue : installe « App Installer » depuis le Microsoft Store, ou scoop puis « scoop install ffmpeg »." })
    else dire("\nwinget est absent. Installe « App Installer » depuis le Microsoft Store, puis relance. (Autre voie : scoop install ffmpeg)")
  }
  if (!whisperChemin()) await whisperWindows()
} else {
  if (!ffmpegChemin()) dire("\n→ ffmpeg : sudo apt install ffmpeg (ou l'équivalent de ta distribution)")
  if (!whisperChemin()) dire("\n→ Whisper : sudo apt install git cmake build-essential, puis HyperFrames le compile à la première transcription")
}

// 5. Modèle de transcription et 6. navigateur de rendu (téléchargés une fois)
if (!guide && hyperframesChemin() && ffmpegChemin()) {
  if (!a["sans-modele"] && whisperChemin() && !existsSync(join(dossierModeles(), "ggml-small.bin"))) {
    dire("\n→ Modèle de transcription « small » (466 Mo, une seule fois)…")
    const tmp = mkdtempSync(join(tmpdir(), "studio-")), wav = join(tmp, "silence.wav")
    await ffmpeg(["-y", "-v", "error", "-f", "lavfi", "-i", "anullsrc=r=16000:cl=mono", "-t", "1", wav])
    const r = await hyperframes(["transcribe", wav, "--engine", "whisper", "--model", "small", "--language", "fr", "--json", "-d", tmp])
    dire(existsSync(join(dossierModeles(), "ggml-small.bin")) ? "  OK" : `  Pas encore : il se téléchargera à la première transcription.\n${r.erreurs.split("\n").slice(-3).join("\n")}`)
    rmSync(tmp, { recursive: true, force: true })
  }
  dire("\n→ Navigateur de rendu pour HyperFrames (une seule fois)…")
  const r = await hyperframes(["browser", "ensure"])
  dire(r.code === 0 ? "  OK" : "  Il se téléchargera au premier rendu.")
} else if (guide) {
  dire("\n→ Ensuite, ces deux téléchargements se font tout seuls au premier usage : le modèle de transcription (466 Mo) et le navigateur de rendu.")
}

// 7. Bilan
if (!guide) {
  dire("\nBilan :")
  const r = verifier()
  for (const x of r) dire(`${x.ok ? "  ✓" : x.obligatoire ? "  ✗" : "  ·"} ${x.nom} : ${x.detail}`)
  const manque = r.filter((x) => !x.ok && x.obligatoire)
  if (manque.length) {
    dire(`\nIl manque encore : ${manque.map((x) => x.nom).join(", ")}.`)
    if (WIN) dire("Sur Windows, ferme et rouvre le terminal après une installation winget, puis relance node outils/installer.mjs.")
    process.exit(1)
  }
  dire("\nTout est prêt. Lance le dashboard : npm run studio")
}
