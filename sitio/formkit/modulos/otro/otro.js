/* =========================================================
   otro.js · Módulo «otro» · nivel RECOMENDADO

   Opción «Otro» con especificación. Sirve para opción única, opción
   múltiple, lista desplegable (select) y tarjetas seleccionables.

   Contrato HTML:
     · La opción lleva value="otro" (o el valor que declare data-otro-valor
       en el campo de texto) y va al final de la lista, nunca premarcada.
     · El campo de texto es un [data-campo] propio, con
         data-si="<campo de opciones>=otro"   → sólo existe mientras «Otro» esté elegida
         data-otro-de="<campo de opciones>"   → este módulo lo gobierna
         data-requerido                       → obligatorio sólo mientras exista
       y una etiqueta visible («Especifica cuál»).
   La variante simple («Otro» sin especificación) no necesita este módulo:
   es una opción más.

   Qué hace el módulo:
     · pone aria-controls (y aria-expanded si es un select) en el control que gobierna el
       texto, para que el lector de pantalla sepa que algo se desplegó;
     · no mueve el foco por la persona;
     · al desmarcar, el núcleo oculta el campo (no viaja) y lo escrito se
       conserva: si vuelve a elegir «Otro» lo recupera;
     · comprueba que lo especificado no repita una opción existente y lo
       sugiere sin bloquear;
     · el mensaje de obligatorio es propio («Escribe cuál es la otra opción»).

   El servidor repite las dos reglas: texto de «Otro» sólo si «Otro» fue
   elegida, y texto obligatorio cuando sí lo fue (ver codigo/servidor).
   ========================================================= */
(function () {
  'use strict';
  FormKit.registra('otro', {
    selector: '[data-otro-de]',
    iniciar(form, ctx) {
      const { $, $$, envoltura, valorDe, etiquetaDe, plantilla, M, normalizaBusqueda } = ctx;

      for (const texto of $$('[data-otro-de]', form)) {
        const nombreTexto = texto.dataset.campo;
        const nombreOpciones = texto.dataset.otroDe;
        const valorOtro = texto.dataset.otroValor || 'otro';
        const grupo = envoltura(nombreOpciones);
        if (!grupo) continue;
        const control = ctx.controlPrincipal(nombreTexto);
        if (control && !control.id) control.id = ctx.idUnico(`otro-${nombreTexto}`);
        texto.dataset.mensaje = plantilla(M.obligatorioOtro, { etiqueta: etiquetaDe(nombreOpciones) });

        /* El control que gobierna: el radio/casilla «otro» o el select. */
        const gobierna = () => {
          const radio = $$('input[type="radio"],input[type="checkbox"]', grupo).find((i) => i.value === valorOtro);
          return radio || $('select', grupo);
        };
        const pinta = () => {
          const g = gobierna();
          if (!g) return;
          const v = valorDe(nombreOpciones);
          const abierto = Array.isArray(v) ? v.includes(valorOtro) : v === valorOtro;
          /* aria-expanded sólo lo admite el select (rol combobox); en un radio o
             casilla no está permitido (axe aria-allowed-attr): ahí basta
             aria-controls, que es global, y el anuncio del bloque al aparecer. */
          if (g.tagName === 'SELECT') g.setAttribute('aria-expanded', String(abierto));
          if (control) g.setAttribute('aria-controls', texto.id || (texto.id = ctx.idUnico(`otro-caja-${nombreTexto}`)));
        };
        pinta();
        grupo.addEventListener('change', pinta);

        /* Lo especificado no debe repetir una opción que ya existe. */
        const opcionesVisibles = () => $$('input[type="radio"],input[type="checkbox"],option', grupo).filter((i) => i.value && i.value !== valorOtro).map((i) => {
          if (i.tagName === 'OPTION') return i.textContent.trim();
          const lab = i.closest('label');
          const nom = lab && ($('.opcion-nombre', lab) || lab);
          return nom ? nom.textContent.trim() : i.value;
        });
        ctx.sugerencias.push((n) => {
          if (n !== nombreTexto || !control) return '';
          const escrito = normalizaBusqueda(control.value);
          const repetida = escrito && opcionesVisibles().find((o) => normalizaBusqueda(o) === escrito);
          return repetida ? plantilla(M.repiteOpcion, { texto: repetida }) : '';
        });
      }
    }
  });
}());
