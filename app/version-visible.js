/* Distintivo de versión siempre visible (guía SIA, sección 8, «Versión en pantalla»).
   Lee la versión escrita en la página al construirla (<meta name="sia-version" content="0.N">, herramientas/
   construir-sitio.mjs) y pinta, fijo en pantalla:
     0.N  → «Versión de prueba 0.N»   (estilo de prueba)
     1, 1.1… → «Versión 1»             (estilo instalado en el SIA)
   Así dice la versión del código que corre, también sin red o con la página en caché (auditoría 2026-10-20, B6-04;
   decisión 7a de Liber), y no pide nada (D4-03). Sólo si la página no la trae lee el archivo VERSION publicado junto a
   ella (o el de <meta name="sia-version-src" content="../VERSION">; requiere connect-src 'self' en la CSP).
   Si no la encuentra, dice «Versión sin identificar» en lugar de esconderse. Sin dependencias. */
(function () {
  'use strict';
  var escrita = document.querySelector('meta[name="sia-version"]');
  var meta = document.querySelector('meta[name="sia-version-src"]');
  var origen = (meta && meta.content) || 'VERSION';

  function pintar(version) {
    var el = document.getElementById('version-sia');
    if (!el) {
      el = document.createElement('div');
      el.id = 'version-sia';
      el.setAttribute('data-testid', 'version-sia');
      document.body.appendChild(el);
    }
    var valida = /^\d+(\.\d+)*$/.test(version || '');
    var prueba = valida && /^0\./.test(version);
    el.className = 'version-sia ' + (!valida ? 'version-sia--error' : prueba ? 'version-sia--prueba' : 'version-sia--sia');
    el.textContent = !valida ? 'Versión sin identificar' : prueba ? 'Versión de prueba ' + version : 'Versión ' + version;
    document.documentElement.setAttribute('data-version-sia', valida ? version : 'desconocida');
  }

  function iniciar() {
    if (escrita) { pintar((escrita.content || '').trim()); return; }
    fetch(origen, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) { pintar(t.trim()); })
      .catch(function () { pintar(''); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
