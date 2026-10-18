/* =========================================================
   mensajes-usted.js · Textos del estándar en usted, para las pantallas del personal

   El Estándar de formularios del SIA habla de tú; las pantallas del personal (revisión documental, citas, cotejo,
   grupos, asistencia, aplicar el examen y material de estudio) hablan de usted. Desde la 1.3.2 todos los textos que se ven —los generales,
   los de los formatos (fmt…), las cruzadas (cz…) y la longitud (minimoCaracteres, maximoCaracteres)— viven en
   «mensajes» (P95), y desde la 1.3.4 el formato «fecha» ya da su límite en día/mes/año (P112). Por eso aquí sólo hay
   textos: sustituye a app/config-usted.js, que además envolvía los formatos para cambiar su redacción.

   En el navegador se carga DESPUÉS de validaciones.config.js y de la configuración de la página, y ANTES del núcleo:
   se suma a FORMKIT_CONFIG.mensajes. En el servidor (etapa 3, y aquí en herramientas/probar-esquemas.mjs) los mismos
   textos se pasan a validaPayload(…, { mensajes: APD_MENSAJES_USTED }), para que la API responda igual.
   ========================================================= */
(function (global) {
  'use strict';
  const M = {
    // Generales
    obligatorioTexto: 'Complete «{etiqueta}».',
    obligatorioOpcion: 'Elija una opción en «{etiqueta}».',
    obligatorioCasilla: 'Marque la casilla «{etiqueta}» para continuar.',
    obligatorioArchivos: 'Adjunte al menos un archivo en «{etiqueta}».',
    obligatorioOtro: 'Escriba cuál es la otra opción en «{etiqueta}».',
    minimoOpciones: 'Elija al menos {min} opciones en «{etiqueta}».',
    maximoOpciones: 'Elija como máximo {max} opciones en «{etiqueta}».',
    soloLista: 'Elija una opción de la lista en «{etiqueta}».',
    repiteOpcion: '«{texto}» ya está en la lista: elija esa opción.',
    minimoCaracteres: 'Escriba al menos {min} caracteres en «{etiqueta}»; van {n}.',
    maximoCaracteres: 'Use hasta {max} caracteres en «{etiqueta}».',
    // Resumen de errores (P116): habla de respuestas y distingue el rechazo del servidor
    resumenUno: 'Para continuar, revise 1 respuesta.',
    resumenVarios: 'Para continuar, revise {n} respuestas.',
    resumenServidorUno: 'No se pudo enviar: revise 1 respuesta.',
    resumenServidorVarios: 'No se pudo enviar: revise {n} respuestas.',
    // Confirmar (P113)
    confirmaTitulo: '¿Confirma?',
    // Formatos que aparecen en las pantallas del personal (fecha y hora de cita o de curso, factura, motivos)
    fmtNombre: 'Escriba sólo letras, espacios, apóstrofe, guion o punto. Ejemplo: María José',
    fmtNombreLargo: 'El nombre es demasiado largo: use hasta {max} caracteres.',
    fmtCorreoLargo: 'El correo es demasiado largo: use hasta {max} caracteres.',
    fmtCorreoDominio: 'Revise el dominio después de la arroba: debe llevar un punto. Ejemplo: nombre@dominio.mx',
    fmtCorreoSugerencia: '¿Quiso escribir {correo}?',
    fmtTelefono: 'Escriba 10 dígitos, sin lada internacional. Ejemplo: 5512345678',
    fmtCurpEstructura: 'La CURP no tiene la estructura esperada. Revísela tal como aparece en el documento.',
    fmtCurpFecha: 'La fecha dentro de la CURP (posiciones 5 a 10) no es una fecha real. Revísela.',
    fmtCurpFutura: 'La fecha de nacimiento dentro de la CURP está en el futuro. Revísela.',
    fmtCurpEntidad: 'La entidad de nacimiento dentro de la CURP (posiciones 12 y 13) no corresponde a ninguna clave. Revísela.',
    fmtCurpDigito: 'El último carácter de la CURP no coincide con el resto. Revise que esté completa y sin letras cambiadas por números.',
    fmtRfcFecha: 'La fecha dentro del RFC no es una fecha real. Revísela.',
    fmtNumero: 'Escriba sólo números; para decimales use punto. Ejemplo: 12.5',
    fmtNumeroEntero: 'Escriba un número entero, sin decimales.',
    fmtNumeroPaso: 'Use múltiplos de {paso}.',
    fmtFecha: 'Escriba una fecha real con el formato AAAA-MM-DD. Ejemplo: 2026-03-15',
    fmtFechaDma: 'Escriba una fecha real como día/mes/año. Ejemplo: 23/07/1985',
    fmtFechaDmaAnio: 'Revise el año: escriba los cuatro dígitos, de 1900 en adelante. Ejemplo: 1985',
    fmtHora: 'Escriba la hora en formato de 24 horas, HH:MM. Ejemplo: 14:30',
    fmtTextoMin: 'Escriba al menos {min} caracteres; van {n}.',
    fmtTextoMax: 'Use hasta {max} caracteres; van {n}.',
    fmtTextoLegible: 'Descríbalo con sus palabras, en una o dos frases completas.',
    fmtCoordenadas: 'Escriba latitud y longitud separadas por coma. Ejemplo: 19.4326,-99.1332',
    fmtFolio: 'Escriba el folio tal como aparece en el acuse, con letras, números y guiones.',
    fmtFolioFiscal: 'El folio fiscal tiene 36 caracteres: números y letras de la A a la F, en grupos de 8, 4, 4, 4 y 12 separados por guiones. Cópielo como aparece en la factura.',
    czCurpFecha: 'La fecha de nacimiento no coincide con la CURP. Revise que ambos datos estén correctos.',
    czCurpSexo: 'El sexo indicado no coincide con el de la CURP. Revise ambos datos.',
    czCurpEntidad: 'La entidad de nacimiento no coincide con la de la CURP. Revise ambos datos.',
    czIgual: 'Los dos valores no coinciden. Escríbalos igual en ambos campos.',
    czCpColonia: 'El código postal no corresponde a la colonia elegida según el catálogo. Revise ambos datos; puede continuar si está seguro.',
    // Módulos
    copiarFallo: 'No se pudo copiar. Seleccione el texto y cópielo a mano.',
    compartirFallo: 'Su navegador no permite compartir desde aquí. Copie el enlace.',
    envioError: 'No se pudo enviar. Lo que capturó sigue aquí; intente de nuevo.',
    envioTimeout: 'El envío tardó demasiado y se detuvo. Lo que capturó sigue aquí; intente de nuevo.',
    envioLimite: 'Por ahora no se pueden recibir más envíos desde este equipo. Lo que capturó no se perdió; intente más tarde.',
    descargaError: 'No se pudo preparar el archivo. Intente de nuevo.',
    archRechazoFirma: 'el contenido del archivo no corresponde a su extensión. Elija el archivo original.',
    archRechazoPeso: 'pesa {peso} y el máximo es {mb} MB. Reduzca su tamaño o elija otro.',
    archRechazoDuplicado: 'ya adjuntó ese mismo archivo.',
    archLleno: 'Ya adjuntó los {max} archivos. Para cambiar uno, quítelo.',
    archLlenoUno: 'Ya adjuntó el archivo. Para cambiarlo, quítelo.',
    comboLibre: 'No está en la lista: se guarda como lo escribió.',
    cascadaEspera: 'Primero elija {padre}.',
    cascadaSinCatalogo: 'No se pudo cargar la lista; escriba el dato a mano.',
    // Motivos frecuentes de observación: el grupo lleva el nombre del documento (data-chips-etiqueta, P97)
    chipsFijos: 'Motivos frecuentes para {etiqueta}',
    visorError: 'No se pudo mostrar el documento aquí. Ábralo en otra pestaña con el enlace de arriba.',
    visorNavegador: 'Se muestra con el visor del navegador. Si no lo ve completo, ábralo en otra pestaña con el enlace de arriba.',
    sesionExpira: 'Su sesión terminará en {min} minutos. Guarde o continúe para mantenerla.'
  };
  global.APD_MENSAJES_USTED = M;
  if (global.document) {
    const previa = global.FORMKIT_CONFIG || {};
    global.FORMKIT_CONFIG = Object.assign({}, previa, { mensajes: Object.assign({}, previa.mensajes, M) });
  }
}(typeof window !== 'undefined' ? window : globalThis));
