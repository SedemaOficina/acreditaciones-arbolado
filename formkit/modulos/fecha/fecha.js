/* =========================================================
   fecha.js · Módulo «fecha» · nivel RECOMENDADO

   Fecha y hora sobre el control nativo (que en el teléfono abre la rueda del
   sistema) con: botón «Hoy» / «Ahora» en la zona horaria de la Ciudad de
   México, límites configurables por atributo (min, max, data-no-futura) y
   atajos de rango («Últimos 7 días») para pares inicio–fin.

   Contrato HTML:
     <div class="campo fecha" data-campo="fecha_hechos" data-formato="fecha" data-no-futura>
       <label class="etiqueta" for="fecha_hechos">Fecha</label>
       <p class="ayuda">Formato AAAA-MM-DD.</p>
       <div class="fecha-grupo">
         <input class="control" id="fecha_hechos" name="fecha_hechos" type="date">
         <button type="button" class="btn btn-secundario fecha-hoy" data-hoy>Hoy</button>
       </div>
     </div>
   Para hora: type="time", data-formato="hora" y data-ahora en el botón.
   Para rango: en el contenedor data-rango="inicio,fin" data-atajos="7,30,90".
   Para edad: data-deriva="edad=edad" en el campo de la fecha de nacimiento;
   el destino es un [data-campo] con <input readonly>. La edad nunca se
   escribe a mano: se calcula, también cuando la fecha viene de la CURP.
   Para la fecha de nacimiento, sin calendario: data-formato="fecha-dma" en
   un <input type="text" inputmode="numeric" maxlength="10">; se escribe
   día/mes/año (23/07/1985) y la escritura se acomoda sola.
   ========================================================= */
(function () {
  'use strict';
  FormKit.registra('fecha', {
    selector: '[data-hoy],[data-ahora],[data-rango],[data-formato="fecha"][data-deriva],[data-formato="fecha-dma"]',
    iniciar(form, ctx) {
      const { $, $$, cfg, M, anuncia, envoltura, controlPrincipal, validaYPinta, programaBorrador } = ctx;

      form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-hoy],[data-ahora],[data-atajo]');
        if (!b || !form.contains(b)) return;
        if (b.hasAttribute('data-atajo')) { aplicaAtajo(b); return; }
        const campo = b.closest('[data-campo]');
        const ctl = campo && controlPrincipal(campo.dataset.campo);
        if (!ctl) return;
        ctl.value = b.hasAttribute('data-hoy') ? cfg.hoyISO() : cfg.ahoraHM();
        ctl.dispatchEvent(new Event('input', { bubbles: true }));
        ctl.dispatchEvent(new Event('change', { bubbles: true }));
        ctx.estadoDe(campo.dataset.campo).tocado = true;
        validaYPinta(campo.dataset.campo);
        anuncia(`${ctx.etiquetaDe(campo.dataset.campo)}: ${ctl.value}`);
        programaBorrador();
      });

      /* Textos de los botones desde la configuración; límites por omisión. */
      for (const b of $$('[data-hoy]', form)) if (!b.textContent.trim()) b.textContent = M.hoy;
      for (const b of $$('[data-ahora]', form)) if (!b.textContent.trim()) b.textContent = M.ahora;
      for (const campo of $$('[data-campo][data-formato="fecha"]', form)) {
        const ctl = controlPrincipal(campo.dataset.campo);
        if (ctl && campo.hasAttribute('data-no-futura') && !ctl.max) ctl.max = cfg.hoyISO();
      }

      /* Edad cumplida desde la fecha de nacimiento, con «hoy» de la Ciudad de
         México. Con una fecha vacía, incompleta o futura, la edad queda vacía. */
      /* Fecha día/mes/año (formato «fecha-dma»), sin calendario: la escritura
         se acomoda sola (23 → 23/, 07 → 23/07/) mientras se escribe al final;
         al borrar o al editar en medio no se mueve nada. Corre en el control,
         antes de que el núcleo lea el valor. */
      for (const campo of $$('[data-campo][data-formato="fecha-dma"]', form)) {
        const ctl = controlPrincipal(campo.dataset.campo);
        if (!ctl || ctl.tagName !== 'INPUT') continue;
        ctl.addEventListener('input', (e) => {
          if ((e.inputType && e.inputType.startsWith('delete')) || ctl.selectionStart !== ctl.value.length) return;
          const v = cfg.guiaFechaDma(ctl.value);
          if (v !== ctl.value) { ctl.value = v; ctl.setSelectionRange(v.length, v.length); }
        });
      }

      for (const campo of $$('[data-campo][data-formato="fecha"][data-deriva],[data-campo][data-formato="fecha-dma"][data-deriva]', form)) {
        const ctl = controlPrincipal(campo.dataset.campo);
        const destinos = campo.dataset.deriva.split(/\s+/).filter((p) => p.startsWith('edad=')).map((p) => p.slice(5));
        if (!ctl || !destinos.length) continue;
        const calcula = () => {
          const v = campo.dataset.formato === 'fecha-dma' ? cfg.isoDeDma(ctl.value) : ctl.value;
          const edad = /^\d{4}-\d{2}-\d{2}$/.test(v) && v <= cfg.hoyISO() ? String(cfg.edadEn(v, cfg.hoyISO())) : '';
          for (const d of destinos) {
            const c = controlPrincipal(d);
            if (!c || c.value === edad) continue;
            c.value = edad;
            c.dispatchEvent(new Event('change', { bubbles: true }));
            if (edad) anuncia(`${ctx.etiquetaDe(d)}: ${edad} años, calculada con la fecha de nacimiento.`);
          }
        };
        ctl.addEventListener('input', calcula);
        ctl.addEventListener('change', calcula);
        calcula();
      }

      /* Rangos: construye los atajos y asegura la validación cruzada. */
      for (const r of $$('[data-rango]', form)) {
        const [ini, fin] = r.dataset.rango.split(',').map((s) => s.trim());
        const campoFin = envoltura(fin);
        if (campoFin && !campoFin.dataset.cruzada) { campoFin.dataset.cruzada = 'rango-fechas'; campoFin.dataset.cruzadaCampos = `inicio=${ini} fin=${fin}`; }
        const dias = (r.dataset.atajos || '').split(',').map((s) => Number(s.trim())).filter(Boolean);
        if (!dias.length) continue;
        const caja = document.createElement('div');
        caja.className = 'fecha-atajos';
        caja.setAttribute('role', 'group');
        caja.setAttribute('aria-label', 'Atajos de periodo');
        for (const d of dias) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'btn btn-secundario fecha-atajo';
          b.dataset.atajo = String(d);
          b.dataset.rangoIni = ini; b.dataset.rangoFin = fin;
          b.textContent = `Últimos ${d} días`;
          caja.appendChild(b);
        }
        r.prepend(caja);
      }

      function aplicaAtajo(b) {
        const d = Number(b.dataset.atajo);
        const hoy = cfg.hoyISO();
        const desde = new Date(`${hoy}T00:00:00Z`); desde.setUTCDate(desde.getUTCDate() - (d - 1));
        const ini = controlPrincipal(b.dataset.rangoIni), fin = controlPrincipal(b.dataset.rangoFin);
        if (!ini || !fin) return;
        ini.value = desde.toISOString().slice(0, 10); fin.value = hoy;
        for (const c of [ini, fin]) { c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true })); }
        validaYPinta(b.dataset.rangoIni); validaYPinta(b.dataset.rangoFin);
        anuncia(`Periodo: del ${ini.value} al ${fin.value}`);
        $$('[data-atajo]', b.parentNode).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }
    }
  });
}());
