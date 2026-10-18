/* =========================================================
   chips.js · Módulo «chips» · nivel OPCIONAL

   Chips de uso frecuente: sugerencias de un toque para campos con
   respuestas repetidas (alcaldías, tipos, categorías) en formularios que
   la misma persona llena muchas veces (captura por personal). El historial
   vive SÓLO en el dispositivo (almacenamiento local), nunca viaja al
   servidor; se muestran como máximo N; cada chip es un botón con nombre
   accesible y estado aria-pressed; la persona puede quitar un chip o borrar
   todo el historial; sin historial, el campo funciona igual.

   Protección de datos: el módulo se niega a guardar historial de un campo
   marcado como dato personal (data-finalidad) o sensible (data-sensible).

   Contrato HTML: data-chips en el [data-campo]. El aviso de privacidad del
   formulario debe mencionar que se guardan sugerencias en el dispositivo.

   Respuestas frecuentes fijas: data-chips-fijos="Texto uno|Texto dos" en el
   [data-campo] muestra siempre esa lista (por ejemplo, los motivos para
   observar un documento). No guarda nada en el dispositivo, así que sirve
   también en datos personales. En un texto largo, el chip agrega su texto
   al final («… Falta una página.») para que la persona lo complete; en un
   campo corto, lo pone como respuesta.
   ========================================================= */
(function () {
  'use strict';
  FormKit.registra('chips', {
    selector: '[data-chips],[data-chips-fijos]',
    iniciar(form, ctx) {
      const { $$, cfg, M, plantilla, anuncia, almacen, controlPrincipal, valorDe, validaCampo, icono, programaBorrador } = ctx;
      const clave = (n) => `${cfg.chips.clave}:${form.dataset.borrador || form.id || 'form'}:${n}`;
      const antesDelControl = (ctl, caja) => (ctl.closest('.select,.combo,.control-grupo,.fecha-grupo') || ctl).insertAdjacentElement('beforebegin', caja);

      for (const campo of $$('[data-chips-fijos]', form)) {
        const n = campo.dataset.campo;
        const ctl = controlPrincipal(n);
        const lista = campo.dataset.chipsFijos.split('|').map((t) => t.trim()).filter(Boolean);
        if (!ctl || !lista.length) continue;
        const largo = ctl.tagName === 'TEXTAREA';
        const caja = document.createElement('div');
        caja.className = 'chips chips-fijos';
        caja.setAttribute('role', 'group');
        /* Nombre del grupo: data-chips-fijos-nombre (completo), o M.chipsFijos («Respuestas frecuentes para …»)
           con data-chips-etiqueta (por ejemplo, el documento: «… para Identificación oficial») o la etiqueta del campo. */
        caja.setAttribute('aria-label', campo.dataset.chipsFijosNombre || plantilla(M.chipsFijos, { etiqueta: campo.dataset.chipsEtiqueta || ctx.etiquetaDe(n).toLowerCase() }));
        for (const t of lista) {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'chip chip-fijo'; b.dataset.chipFijo = t; b.textContent = t;
          caja.appendChild(b);
        }
        antesDelControl(ctl, caja);
        const marca = () => { if (!largo) for (const b of $$('[data-chip-fijo]', caja)) b.setAttribute('aria-pressed', String(valorDe(n) === b.dataset.chipFijo)); };
        caja.addEventListener('click', (e) => {
          const b = e.target.closest('[data-chip-fijo]');
          if (!b) return;
          const t = b.dataset.chipFijo;
          const previo = ctl.value.trim();
          ctl.value = largo ? `${previo ? `${previo} ` : ''}${t}${/[.!?]$/.test(t) ? '' : '.'}` : t;
          ctl.dispatchEvent(new Event('input', { bubbles: true }));
          ctl.dispatchEvent(new Event('change', { bubbles: true }));
          ctx.estadoDe(n).tocado = true;
          ctx.validaYPinta(n);
          marca();
          anuncia(plantilla(M.chipsAgregado, { texto: t }));
          if (largo) { ctl.focus(); ctl.setSelectionRange(ctl.value.length, ctl.value.length); }
          programaBorrador();
        });
        ctl.addEventListener('input', marca);
        marca();
      }

      /* Campos con la misma etiqueta (un «¿Qué debe corregir?» por documento):
         el lector de pantalla oiría grupos con el mismo nombre. Se les agrega
         el título de su sección o, si no hay, su número de orden. */
      const grupos = $$('.chips-fijos', form);
      const porNombre = new Map();
      for (const g of grupos) porNombre.set(g.getAttribute('aria-label'), [...(porNombre.get(g.getAttribute('aria-label')) || []), g]);
      for (const [nombre, iguales] of porNombre) {
        if (iguales.length < 2) continue;
        iguales.forEach((g, i) => {
          const zona = g.closest('[data-campo]').parentElement.closest('article,section,fieldset,[data-paso],.tarjeta');
          const titulo = zona && [...zona.querySelectorAll('h1,h2,h3,h4,h5,h6,legend')].find((h) => !h.closest('[data-campo]'));
          const contexto = titulo ? titulo.textContent.replace(/\s+/g, ' ').trim() : plantilla(M.chipsFijosOrden, { n: i + 1, total: iguales.length });
          g.setAttribute('aria-label', plantilla(M.chipsFijosContexto, { nombre, contexto }));
        });
      }

      for (const campo of $$('[data-chips]', form)) {
        const n = campo.dataset.campo;
        if (campo.hasAttribute('data-finalidad') || campo.hasAttribute('data-sensible')) { console.warn(`FormKit: el campo «${n}» es dato personal; no se guardan sugerencias.`); continue; }
        const ctl = controlPrincipal(n);
        if (!ctl) continue;
        const caja = document.createElement('div');
        caja.className = 'chips';
        caja.setAttribute('role', 'group');
        caja.setAttribute('aria-label', `Usados antes en ${ctx.etiquetaDe(n).toLowerCase()}`);
        antesDelControl(ctl, caja);

        const lee = () => { try { return JSON.parse(almacen.lee(clave(n)) || '[]'); } catch (e) { return []; } };
        const escribe = (lista) => almacen.escribe(clave(n), JSON.stringify(lista.slice(0, cfg.chips.max)));

        function pinta() {
          const lista = lee();
          caja.textContent = '';
          caja.hidden = !lista.length;
          if (!lista.length) return;
          for (const v of lista) {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.chip = v;
            b.setAttribute('aria-pressed', String(valorDe(n) === v));
            const t = document.createElement('span'); t.className = 'chip-texto'; t.textContent = v;
            const q = document.createElement('span'); q.className = 'chip-quitar'; q.dataset.chipQuitar = v; q.setAttribute('role', 'button'); q.setAttribute('tabindex', '0'); q.setAttribute('aria-label', plantilla(M.chipsQuitar, { texto: v })); q.appendChild(icono('cerrar', 'icono icono-sm'));
            b.append(t); caja.append(b, q);
          }
          const borrar = document.createElement('button'); borrar.type = 'button'; borrar.className = 'btn-enlace chips-borrar'; borrar.dataset.chipsBorrar = ''; borrar.textContent = M.chipsBorrar;
          caja.appendChild(borrar);
        }

        caja.addEventListener('click', (e) => {
          const q = e.target.closest('[data-chip-quitar]');
          if (q) { escribe(lee().filter((v) => v !== q.dataset.chipQuitar)); pinta(); anuncia(`Sugerencia quitada.`); return; }
          if (e.target.closest('[data-chips-borrar]')) { almacen.borra(clave(n)); pinta(); anuncia('Historial borrado.'); ctl.focus(); return; }
          const b = e.target.closest('[data-chip]');
          if (!b) return;
          ctl.value = b.dataset.chip;
          ctl.dispatchEvent(new Event('input', { bubbles: true }));
          ctl.dispatchEvent(new Event('change', { bubbles: true }));
          ctx.estadoDe(n).tocado = true;
          ctx.validaYPinta(n);
          pinta();
          anuncia(`${ctx.etiquetaDe(n)}: ${b.dataset.chip}`);
          programaBorrador();
        });
        caja.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-chip-quitar]')) { e.preventDefault(); e.target.closest('[data-chip-quitar]').click(); } });

        /* Se guarda al salir del campo con un valor válido. */
        campo.addEventListener('focusout', () => {
          const v = valorDe(n);
          if (!v || validaCampo(n)) return;
          const lista = [v, ...lee().filter((x) => x !== v)];
          escribe(lista);
          pinta();
        });
        pinta();
      }
    }
  });
}());
