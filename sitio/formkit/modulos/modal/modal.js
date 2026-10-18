/* =========================================================
   modal.js · Módulo «modal» · nivel RECOMENDADO

   Diálogos con <dialog> nativo: el navegador atrapa el foco, cierra con
   Escape y devuelve el foco a quien lo abrió. Dos usos:
     1. Contenido que hay que leer (aviso de privacidad): botones con
        data-abre-dialogo="id" y data-cierra-dialogo dentro del <dialog>.
     2. Confirmación de una acción con efecto:
        FormKit.confirma(ancla, {titulo, texto, consecuencias, irreversible, si, no, peligro}) → Promise<boolean>
        Crea un <dialog role="alertdialog"> en el momento y lo retira al cerrar.
        · titulo pregunta por la acción con su objeto («¿Rechazar la solicitud EJ-123?»);
        · consecuencias: lista de lo que pasará («La persona recibe el motivo por correo»);
        · irreversible: true agrega «No se puede deshacer.» con su icono;
        · si repite el verbo de la acción («Rechazar solicitud»), nunca «Aceptar»;
        · no es la salida segura («Volver sin cambios») y recibe el foco;
        · peligro: true para lo destructivo (rechazar, cancelar, eliminar).
        Guardar una nota no pide confirmación; cerrar un trámite sí, con sus consecuencias.
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
    const M = FormKit.config.mensajes;
    const { idUnico } = FormKit.utilidades;
    return new Promise((resolve) => {
      const d = document.createElement('dialog');
      d.className = 'dialogo dialogo-confirma';
      d.setAttribute('role', 'alertdialog');
      const idT = idUnico('conf-t'), idD = idUnico('conf-d');
      d.setAttribute('aria-labelledby', idT);
      const h = document.createElement('h2'); h.className = 'titulo-bloque dialogo-titulo'; h.id = idT; h.textContent = cfg.titulo || M.confirmaTitulo;
      /* Texto, consecuencias e «irreversible» forman la descripción que oye el lector. */
      const desc = document.createElement('div'); desc.id = idD; desc.className = 'dialogo-desc';
      if (cfg.texto) { const p = document.createElement('p'); p.className = 'texto-gris'; p.textContent = cfg.texto; desc.appendChild(p); }
      const consecuencias = (cfg.consecuencias || []).filter(Boolean);
      if (consecuencias.length) {
        const t = document.createElement('p'); t.className = 'dialogo-consecuencias-titulo'; t.textContent = M.confirmaConsecuencias;
        const ul = document.createElement('ul'); ul.className = 'dialogo-consecuencias';
        for (const c of consecuencias) { const li = document.createElement('li'); li.textContent = c; ul.appendChild(li); }
        desc.append(t, ul);
      }
      if (cfg.irreversible) {
        const p = document.createElement('p'); p.className = 'dialogo-irreversible';
        p.append(FormKit.icono('alerta'), document.createTextNode(M.confirmaIrreversible));
        desc.appendChild(p);
      }
      if (desc.childNodes.length) d.setAttribute('aria-describedby', idD);
      const acc = document.createElement('div'); acc.className = 'acciones dialogo-acciones';
      const no = document.createElement('button'); no.type = 'button'; no.className = 'btn btn-secundario'; no.textContent = cfg.no || M.confirmaNo; no.dataset.r = 'no';
      const si = document.createElement('button'); si.type = 'button'; si.className = cfg.peligro ? 'btn btn-peligro' : 'btn btn-primario'; si.textContent = cfg.si || M.confirmaSi; si.dataset.r = 'si';
      if (!cfg.si) console.warn('FormKit.confirma: «si» debe repetir el verbo de la acción («Rechazar solicitud»), no «Confirmar».');
      acc.append(no, si);
      d.append(h, desc, acc);
      document.body.appendChild(d);
      const termina = (ok) => { cierra(d); d.remove(); if (ancla && ancla.focus) ancla.focus(); resolve(ok); };
      d.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) termina(b.dataset.r === 'si'); });
      d.addEventListener('cancel', (e) => { e.preventDefault(); termina(false); });
      abre(d);
      /* El foco inicial va a la opción segura («Volver sin cambios»), no a la que actúa. */
      no.focus();
      FormKit.anuncia(`${h.textContent} ${desc.textContent}`, true);
    });
  };
}());
