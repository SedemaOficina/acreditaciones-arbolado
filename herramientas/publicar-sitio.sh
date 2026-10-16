#!/usr/bin/env bash
# PUBLICA la versión de prueba del sitio en GitHub Pages: la rama gh-pages es una copia exacta de sitio/.
# Antes se corren construir-sitio, probar-sitio y probar-esquemas, y se hace commit en main.
# Cada publicación sube el número de versión de prueba (0.N → 0.N+1; herramientas/nueva-version.mjs), lo
# anota en docs/VERSIONES.md y lo guarda en main, para saber en pantalla si se ve la última.
#
#   bash herramientas/publicar-sitio.sh
set -euo pipefail
raiz="$(cd "$(dirname "$0")/.." && pwd)"
cd "$raiz"
if [ -n "$(git status --porcelain sitio)" ]; then
  echo "sitio/ tiene cambios sin commit: primero commit en main." >&2; exit 1
fi
version="$(node herramientas/nueva-version.mjs | sed 's/^Versión de prueba //')"
git add VERSION sitio docs/VERSIONES.md
git commit -q -m "Versión de prueba ${version}"
git push -q origin HEAD
rama="$(git subtree split --prefix sitio HEAD)"
git push --force origin "$rama:refs/heads/gh-pages"
echo "Publicado: versión de prueba ${version} · gh-pages = sitio/ de $(git rev-parse --short HEAD)"
