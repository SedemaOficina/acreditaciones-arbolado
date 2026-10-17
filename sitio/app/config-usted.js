/* =========================================================
   config-usted.js · Textos del estándar en usted, para las pantallas del personal

   El Estándar de formularios del SIA habla de tú; las pantallas del personal (revisión documental, cotejo y agenda
   de citas) hablan de usted. Aquí se sobrescriben, sin editar formkit/, los textos del estándar que se ven en esas
   pantallas: los de FORMKIT_CONFIG.mensajes y los mensajes de los formatos que usan (fecha, hora, RFC y folio
   fiscal de la factura), que están en el código de cada formato y no en «mensajes» (hallazgo P95).

   Se carga DESPUÉS de validaciones.config.js y de la configuración de la página, y ANTES del núcleo: el núcleo
   toma window.FORMKIT_CONFIG al cargarse. En la etapa 3 la API del personal valida con esta misma configuración
   (validaPayload(…, { config })), para que el servidor responda con los mismos textos.

   Queda en tú, porque el núcleo lo escribe sin pasar por «mensajes»: «Escribe al menos N caracteres en «…»; van N.»
   (hallazgo P95).
   ========================================================= */
(function (global) {
  'use strict';
  const BASE = global.FORMKIT_VALIDACIONES;
  const M = {
    obligatorioTexto: 'Complete «{etiqueta}».',
    obligatorioOpcion: 'Elija una opción en «{etiqueta}».',
    obligatorioCasilla: 'Marque la casilla «{etiqueta}» para continuar.',
    obligatorioArchivos: 'Adjunte al menos un archivo en «{etiqueta}».',
    obligatorioOtro: 'Escriba cuál es la otra opción en «{etiqueta}».',
    minimoOpciones: 'Elija al menos {min} opciones en «{etiqueta}».',
    maximoOpciones: 'Elija como máximo {max} opciones en «{etiqueta}».',
    soloLista: 'Elija una opción de la lista en «{etiqueta}».',
    repiteOpcion: '«{texto}» ya está en la lista: elija esa opción.',
    copiarFallo: 'No se pudo copiar. Seleccione el texto y cópielo a mano.',
    compartirFallo: 'Su navegador no permite compartir desde aquí. Copie el enlace.',
    envioError: 'No se pudo enviar. Lo que capturó sigue aquí; intente de nuevo.',
    envioTimeout: 'El envío tardó demasiado y se detuvo. Lo que capturó sigue aquí; intente de nuevo.',
    envioLimite: 'Por ahora no se pueden recibir más envíos desde este equipo. Lo que capturó no se perdió; intente más tarde.',
    archRechazoFirma: 'el contenido del archivo no corresponde a su extensión. Elija el archivo original.',
    archRechazoPeso: 'pesa {peso} y el máximo es {mb} MB. Reduzca su tamaño o elija otro.',
    archRechazoDuplicado: 'ya adjuntó ese mismo archivo.',
    archLleno: 'Ya adjuntó los {max} archivos. Para cambiar uno, quítelo.',
    archLlenoUno: 'Ya adjuntó el archivo. Para cambiarlo, quítelo.',
    cascadaEspera: 'Primero elija {padre}.',
    cascadaSinCatalogo: 'No se pudo cargar la lista; escriba el dato a mano.',
    chipsFijos: 'Motivos frecuentes',
    visorError: 'No se pudo mostrar el documento aquí. Ábralo en otra pestaña con el enlace de arriba.',
    visorNavegador: 'Se muestra con el visor del navegador. Si no lo ve completo, ábralo en otra pestaña con el enlace de arriba.',
    sesionExpira: 'Su sesión terminará en {min} minutos. Guarde o continúe para mantenerla.'
  };
  /* Mensajes de los formatos: mismo cálculo del estándar, con el texto en usted. */
  const enUsted = (t) => String(t)
    .replace(/\bEscribe\b/g, 'Escriba').replace(/\bescribe\b/g, 'escriba').replace(/\bRevisa\b/g, 'Revise')
    .replace(/\bRevísala\b/g, 'Revísela').replace(/\bCópialo\b/g, 'Cópielo').replace(/\bUsa\b/g, 'Use').replace(/\busa\b/g, 'use');
  const formatos = {};
  for (const f of ['fecha', 'hora', 'rfc', 'folio-fiscal', 'numero']) {
    const original = BASE && BASE.formatos[f] && BASE.formatos[f].valida;
    if (original) formatos[f] = { valida: (v, a) => enUsted(original(v, a)) };
  }
  const previa = global.FORMKIT_CONFIG || {};
  global.FORMKIT_CONFIG = Object.assign({}, previa, {
    /* pdf.js del estándar, copiado junto al sitio (herramientas/construir-sitio.mjs) */
    visor: Object.assign({}, previa.visor, { pdfjs: 'vendor/pdfjs-dist/' }),
    mensajes: Object.assign({}, previa.mensajes, M),
    formatos: Object.assign({}, previa.formatos, Object.fromEntries(Object.entries(formatos)
      .map(([k, v]) => [k, Object.assign({}, (previa.formatos || {})[k], v)])))
  });
}(window));
