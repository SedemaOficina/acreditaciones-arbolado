/* archivos-lleno.js · Carga de archivos más clara (decisión 2026-10-17; hallazgo del estándar P71)

   El módulo «archivos» del estándar deja a la vista «Elegir archivo» aunque el campo ya tenga todos los archivos que
   admite (data-max), y la persona puede creer que no se cargó nada. Aquí, con el máximo alcanzado, el contenedor
   [data-archivos] recibe data-lleno y la hoja de estilos oculta la zona de carga y el botón de cámara; al quitar el
   archivo vuelven. El archivo listo se ve en verde (apd.css). Con data-max="1", el texto del límite deja de decir
   «Hasta 1 archivos…» y dice «Un archivo de hasta N MB». Se carga después del módulo «archivos». */
(function () {
  'use strict';
  function revisa(zona) {
    const campo = zona.closest('[data-campo]');
    const max = Number(campo && campo.dataset.max) || 0;
    const lista = zona.querySelector('.lista-arch');
    if (!max || !lista) return;
    const vigentes = Array.from(lista.children).filter((li) => li.dataset.estado !== 'error').length;
    if (vigentes >= max) zona.setAttribute('data-lleno', ''); else zona.removeAttribute('data-lleno');
  }
  function texto(zona) {
    const campo = zona.closest('[data-campo]');
    const t = zona.querySelector('[data-limite-texto]');
    if (!t || !campo || campo.dataset.max !== '1') return;
    const m = t.textContent.match(/^(.*?\.)\s*Hasta 1 archivos? de (\S+) MB cada uno\.$/);
    if (m) t.textContent = `${m[1].replace('Formatos admitidos:', /,/.test(m[1]) ? 'Formatos admitidos:' : 'Formato admitido:')} Un archivo de hasta ${m[2]} MB.`;
  }
  function inicia() {
    for (const zona of document.querySelectorAll('[data-archivos]')) {
      texto(zona);
      revisa(zona);
      const lista = zona.querySelector('.lista-arch');
      if (lista) new MutationObserver(() => revisa(zona)).observe(lista, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-estado'] });
      const t = zona.querySelector('[data-limite-texto]');
      if (t) new MutationObserver(() => texto(zona)).observe(t, { childList: true, characterData: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(inicia)); else setTimeout(inicia);
}());
