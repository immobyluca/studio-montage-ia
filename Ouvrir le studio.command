#!/bin/bash
# Mac : double-clique ce fichier pour ouvrir le dashboard du studio dans ton navigateur.
# Pour l'arrêter : ferme cette fenêtre du Terminal. (Si macOS bloque le fichier : clic droit, Ouvrir.)
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js est introuvable. Installe-le avec : brew install node"
  echo "Ou demande à ton IA de terminer l'installation (voir CLAUDE.md)."
  read -n 1 -s -r -p "Appuie sur une touche pour fermer."
  exit 1
fi
[ -d node_modules/hyperframes ] || npm install --no-fund --no-audit
exec node dashboard/serveur.mjs --ouvrir
