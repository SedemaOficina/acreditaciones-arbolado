/* =========================================================
   identificadores.js · Módulo «identificadores» · nivel OPCIONAL

   Campos con formato cerrado (CURP, RFC, folios, claves). La validación
   por capas vive en validaciones.config.js; este módulo añade lo que sólo
   tiene sentido en pantalla:
     · mayúsculas y sin espacios mientras se escribe (lo que la persona ve
       es lo que se conserva);
     · derivación de datos desde la CURP a campos de solo lectura
       (minimización: la fecha de nacimiento y el sexo no se piden dos
       veces), con aviso en pantalla y opción de corregir la CURP;
     · enmascarado opcional en revisión y acuse (data-enmascara).

   Contrato HTML:
     <div class="campo" data-campo="curp" data-formato="curp"
          data-deriva="fechaNacimiento=nacimiento sexo=sexo entidad=entidad_nac">
       <label class="etiqueta" for="curp">CURP</label>
       <input class="control" id="curp" name="curp" type="text" maxlength="18" autocomplete="off" spellcheck="false">
     </div>
   Los campos destino son [data-campo] con <input readonly>.
   Un formato correcto no prueba que la CURP exista: cuando eso importe, el
   servidor la contrasta con el servicio oficial de consulta [Fuente: __].
   ========================================================= */
(function () {
  'use strict';
  const MAYUSCULAS = ['curp', 'rfc', 'folio'];
  FormKit.registra('identificadores', {
    selector: '[data-formato="curp"],[data-formato="rfc"],[data-formato="folio"]',
    iniciar(form, ctx) {
      const { $$, cfg, anuncia, controlPrincipal, envoltura, etiquetaDe, validaCampo } = ctx;
      for (const campo of $$('[data-campo]', form)) {
        const f = campo.dataset.formato;
        if (!MAYUSCULAS.includes(f)) continue;
        const ctl = controlPrincipal(campo.dataset.campo);
        if (!ctl) continue;
        ctl.setAttribute('autocapitalize', 'characters');
        ctl.setAttribute('spellcheck', 'false');
        if (f === 'curp' && !ctl.maxLength) ctl.maxLength = cfg.curp.largo;
        ctl.addEventListener('input', () => {
          const pos = ctl.selectionStart;
          const v = cfg.formatos[f].normaliza(ctl.value);
          if (v !== ctl.value) { ctl.value = v; try { ctl.setSelectionRange(pos, pos); } catch (e) { /* tipos sin selección */ } }
          if (f === 'curp') deriva(campo, ctl);
        });
        if (f === 'curp') deriva(campo, ctl);
      }

      /* Rellena los campos derivados sólo con una CURP válida; los vacía si
         deja de serlo. Nunca en silencio: anuncia y muestra la ayuda. */
      function deriva(campo, ctl) {
        if (!campo.dataset.deriva) return;
        const valida = !validaCampo(campo.dataset.campo) && ctl.value.length === cfg.curp.largo;
        const datos = valida ? cfg.formatos.curp.deriva(ctl.value) : {};
        const textos = { H: 'Hombre', M: 'Mujer', X: 'No binario' };
        for (const par of campo.dataset.deriva.split(/\s+/).filter(Boolean)) {
          const [clave, destino] = par.split('=');
          const envDestino = envoltura(destino);
          const ctlDestino = envDestino && controlPrincipal(destino);
          if (!ctlDestino) continue;
          const bruto = datos[clave] || '';
          /* La fecha de nacimiento va como el destino la pide: AAAA-MM-DD o, en «fecha-dma», DD/MM/AAAA. */
          const valor = clave === 'sexo' && ctlDestino.tagName !== 'SELECT' ? (textos[bruto] || bruto)
            : clave === 'fechaNacimiento' && envDestino.dataset.formato === 'fecha-dma' ? cfg.dmaDeIso(bruto) : bruto;
          if (ctlDestino.value !== valor) {
            ctlDestino.value = valor;
            ctlDestino.dispatchEvent(new Event('change', { bubbles: true }));
            if (valor) anuncia(`${etiquetaDe(destino)}: ${valor}, tomado de la CURP.`);
          }
        }
      }
    }
  });

  /* Enmascara un identificador para revisión y acuse: deja visibles los
     primeros 4 y los últimos 2 caracteres. */
  FormKit.enmascara = (v) => (String(v || '').length > 8 ? `${v.slice(0, 4)}${'•'.repeat(v.length - 6)}${v.slice(-2)}` : v);
}());
