#!/usr/bin/env bash
# PUBLICA la versión de prueba del sitio en GitHub Pages: la rama gh-pages es una copia exacta de sitio/
# (lo que ya está en main). No construye ni prueba: antes se corren construir-sitio, probar-sitio y
# probar-esquemas, y se hace commit en main.
#
#   bash herramientas/publicar-sitio.sh
set -euo pipefail
raiz="$(cd "$(dirname "$0")/.." && pwd)"
cd "$raiz"
if [ -n "$(git status --porcelain sitio)" ]; then
  echo "sitio/ tiene cambios sin commit: primero commit en main." >&2; exit 1
fi
rama="$(git subtree split --prefix sitio HEAD)"
git push --force origin "$rama:refs/heads/gh-pages"
echo "Publicado: gh-pages = sitio/ de $(git rev-parse --short HEAD)"
