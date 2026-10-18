/* Distintivo de versión siempre visible (guía SIA, sección 8, «Versión en pantalla»).
   Lee el archivo VERSION publicado junto a la página y pinta, fijo en pantalla:
     0.N  → «Versión de prueba 0.N»   (estilo de prueba)
     1, 1.1… → «Versión 1»             (estilo instalado en el SIA)
   Si no puede leerlo, dice «Versión sin identificar» en lugar de esconderse.
   Sin dependencias; servido desde el propio sitio. Requiere connect-src 'self' en la CSP.
   Si VERSION no está junto a la página: <meta name="sia-version-src" content="../VERSION">. */
(function () {
  'use strict';
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
    fetch(origen, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) { pintar(t.trim()); })
      .catch(function () { pintar(''); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
