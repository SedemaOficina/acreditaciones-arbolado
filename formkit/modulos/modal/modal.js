/* =========================================================
   modal.js · Módulo «modal» · nivel RECOMENDADO

   Diálogos con <dialog> nativo: el navegador atrapa el foco, cierra con
   Escape y devuelve el foco a quien lo abrió. Dos usos:
     1. Contenido que hay que leer (aviso de privacidad): botones con
        data-abre-dialogo="id" y data-cierra-dialogo dentro del <dialog>.
     2. Confirmación de una acción que no se deshace:
        FormKit.confirma(ancla, {titulo, texto, si, no, peligro}) → Promise<boolean>
        Crea un <dialog role="alertdialog"> en el momento y lo retira al cerrar.
   CUÁNDO NO: para errores de campo (van en el campo), para avisos que no
   exigen decisión (van en línea) ni para confirmar acciones recuperables.
   En teléfono el diálogo baja como hoja inferior (modal.css).
   ========================================================= */
(function () {
  'use strict';
  function abre(d) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
  function cierra(d) { if (d.close) d.close(); else d.removeAttribute('open'); }

  FormKit.registra('modal', {
    selector: '[data-abre-dialogo],dialog',
    fueraDelFormulario: true,
    iniciar() {
      /* Los escuchas del documento se registran una sola vez aunque la página
         tenga varios formularios (cada uno inicia sus módulos). */
      if (document.documentElement.dataset.modalListo !== undefined) return;
      document.documentElement.dataset.modalListo = '';
      document.addEventListener('click', (e) => {
        const ab = e.target.closest('[data-abre-dialogo]');
        if (ab) { const d = document.getElementById(ab.dataset.abreDialogo); if (d) abre(d); return; }
        const ce = e.target.closest('[data-cierra-dialogo]');
        if (ce) { const d = ce.closest('dialog'); if (d) cierra(d); }
      });
      /* Clic en el velo (fuera de la caja) cierra los diálogos que no son de confirmación. */
      document.addEventListener('click', (e) => {
        if (!(e.target instanceof HTMLDialogElement) || e.target.getAttribute('role') === 'alertdialog') return;
        const r = e.target.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) cierra(e.target);
      });
    }
  });

  FormKit.confirma = function (ancla, cfg = {}) {
    return new Promise((resolve) => {
      const d = document.createElement('dialog');
      d.className = 'dialogo dialogo-confirma';
      d.setAttribute('role', 'alertdialog');
      const idT = FormKit.utilidades.idUnico('conf-t'), idD = FormKit.utilidades.idUnico('conf-d');
      d.setAttribute('aria-labelledby', idT);
      if (cfg.texto) d.setAttribute('aria-describedby', idD);
      const h = document.createElement('h2'); h.className = 'titulo-bloque dialogo-titulo'; h.id = idT; h.textContent = cfg.titulo || '¿Confirmas?';
      const p = document.createElement('p'); p.className = 'texto-gris'; p.id = idD; p.textContent = cfg.texto || '';
      const acc = document.createElement('div'); acc.className = 'acciones dialogo-acciones';
      const no = document.createElement('button'); no.type = 'button'; no.className = 'btn btn-secundario'; no.textContent = cfg.no || 'Cancelar'; no.dataset.r = 'no';
      const si = document.createElement('button'); si.type = 'button'; si.className = cfg.peligro ? 'btn btn-peligro' : 'btn btn-primario'; si.textContent = cfg.si || 'Confirmar'; si.dataset.r = 'si';
      acc.append(no, si);
      d.append(h, p, acc);
      document.body.appendChild(d);
      const termina = (ok) => { cierra(d); d.remove(); if (ancla && ancla.focus) ancla.focus(); resolve(ok); };
      d.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) termina(b.dataset.r === 'si'); });
      d.addEventListener('cancel', (e) => { e.preventDefault(); termina(false); });
      abre(d);
      /* El foco inicial va a la opción segura (cancelar), no a la destructiva. */
      no.focus();
      FormKit.anuncia(`${h.textContent} ${p.textContent}`, true);
    });
  };
}());
