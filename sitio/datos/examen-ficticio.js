/* =========================================================
   examen-ficticio.js · Banco de reactivos FICTICIO para probar el examen en línea

   NO SON REACTIVOS DEL EXAMEN REAL. Son preguntas sobre el propio trámite,
   escritas para probar las pantallas (largo de las preguntas, opciones con
   imagen, orden al azar, calificación). El banco real, con su clave de
   respuestas, nunca entra a este repositorio público (P85): se carga directo
   en la base del SIA y la página nunca recibe la respuesta correcta.

   Las opciones de cada pregunta tienen un largo parecido a propósito: en el
   cuadernillo vigente la correcta suele ser la más larga (P74).

   Parámetros de cada examen (P74): el cuadernillo vigente de poda y derribo
   (2025), único para nueva y renovación, tiene 52 reactivos (40 de opción
   múltiple y 3 ejercicios de valoración con 4 reactivos cada uno) y 60
   minutos. Dictaminador: valores de prueba.
   ========================================================= */
(function (global) {
  'use strict';
  const figura = (cuerpo) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" fill="#F4F5F6"/>${cuerpo}</svg>`)}`;
  const TRAZO = 'fill="none" stroke="#2B2D2E" stroke-width="4"';

  const reactivos = [
    { clave: 'F01', tema: 'Sede', texto: '¿Dónde se presenta el examen en línea?', correcta: 'a', opciones: {
      a: 'En el salón de cómputo del PILARES del Vivero Nezahualcóyotl',
      b: 'En la oficina de la alcaldía donde vive la persona solicitante',
      c: 'Desde el teléfono de la persona, en el lugar que ella elija',
      d: 'En el aula de capacitación del Vivero, en un cuadernillo de papel' } },
    { clave: 'F02', tema: 'Calificación', texto: '¿Cuál es la calificación mínima para aprobar el examen de poda y derribo?', correcta: 'b', opciones: { a: '6.0', b: '7.0', c: '8.0', d: '9.0' } },
    { clave: 'F03', tema: 'Calificación', texto: '¿Cuál es la calificación mínima para aprobar el examen de dictaminador técnico?', correcta: 'c', opciones: { a: '6.0', b: '7.0', c: '8.0', d: '9.0' } },
    { clave: 'F04', tema: 'Curso', texto: '¿Cuántos días dura el curso de primera vez?', correcta: 'c', opciones: { a: 'Un día', b: 'Tres días', c: 'Cinco días', d: 'Diez días' } },
    { clave: 'F05', tema: 'Curso', texto: '¿Cuántos días dura el curso de renovación?', correcta: 'a', opciones: { a: 'Un día', b: 'Dos días', c: 'Tres días', d: 'Cinco días' } },
    { clave: 'F06', tema: 'Curso', texto: 'En el curso de primera vez, ¿cuántas faltas se admiten para conservar el derecho a examen?', correcta: 'b', opciones: { a: 'Ninguna', b: 'Una', c: 'Dos', d: 'Tres' } },
    { clave: 'F07', tema: 'Trámite', texto: '¿Quién hace la solicitud de una acreditación?', correcta: 'd', opciones: {
      a: 'La empresa o la dependencia donde trabaja la persona',
      b: 'La alcaldía, con la lista de su personal de áreas verdes',
      c: 'El instructor del curso, cuando integra el grupo',
      d: 'La propia persona, desde su cuenta, de manera individual' } },
    { clave: 'F08', tema: 'Trámite', texto: '¿Qué ocurre si una persona no aprueba el examen?', correcta: 'b', opciones: {
      a: 'Lo vuelve a presentar al día siguiente, sin otro pago',
      b: 'Hace un trámite nuevo completo, incluido el pago de derechos',
      c: 'Su calificación se promedia con la evaluación práctica',
      d: 'Puede pedir a la Dirección que revise su calificación' } },
    { clave: 'F09', tema: 'Trámite', texto: '¿Cómo se identifica el expediente físico de una persona?', correcta: 'a', opciones: {
      a: 'Con un número de expediente por CURP, para todos sus trámites',
      b: 'Con un número distinto para cada solicitud que haya enviado',
      c: 'Con el número de su credencial para votar y su fotografía',
      d: 'Con el folio fiscal de la factura de su pago de derechos' } },
    { clave: 'F10', tema: 'Documentos', texto: 'En una renovación, ¿cuándo se vuelve a cargar un documento?', correcta: 'c', opciones: {
      a: 'Siempre: en cada renovación se cargan todos los documentos',
      b: 'Nunca: la renovación sólo pide el pago de derechos',
      c: 'Sólo si venció o si la persona lo actualizó desde la última vez',
      d: 'Sólo si el instructor del curso anterior lo pide por escrito' } },
    { clave: 'F11', tema: 'Documentos', texto: '¿En qué formato se cargan los documentos de la solicitud?', correcta: 'd', opciones: { a: 'En Word', b: 'En Excel', c: 'En cualquier formato', d: 'En PDF' } },
    { clave: 'F12', tema: 'Documentos', texto: '¿Cuál es el tamaño máximo de cada archivo que se carga?', correcta: 'b', opciones: { a: '1 MB', b: '5 MB', c: '10 MB', d: '50 MB' } },
    { clave: 'F13', tema: 'Sede', texto: '¿Dónde se recoge la acreditación?', correcta: 'c', opciones: {
      a: 'En la alcaldía que corresponde al domicilio de la persona',
      b: 'Llega por correo postal al domicilio que se registró',
      c: 'En el Vivero Nezahualcóyotl, la misma sede del curso',
      d: 'En las oficinas centrales de la Secretaría, en el Centro' } },
    { clave: 'F14', tema: 'Trámite', texto: '¿Qué se necesita para que se asigne la fecha del curso?', correcta: 'a', opciones: {
      a: 'Que en el cotejo se verifique el pago y se cargue la factura',
      b: 'Que la persona elija una fecha en su cuenta al enviar',
      c: 'Que la empresa de la persona confirme por escrito su lugar',
      d: 'Que la persona apruebe antes un examen de conocimientos' } },
    { clave: 'F15', tema: 'Trámite', texto: '¿Qué acreditación debe tener vigente quien solicita la de dictaminador técnico?', correcta: 'b', opciones: {
      a: 'Ninguna: puede solicitarla cualquier persona',
      b: 'La de poda y derribo',
      c: 'Una constancia de un curso privado de arboricultura',
      d: 'Una licencia de manejo vigente' } },
    { clave: 'F16', tema: 'Figuras', texto: '¿Cuál de estas figuras es un triángulo?', correcta: 'c', opciones: {
      a: { imagen: figura(`<circle cx="60" cy="45" r="30" ${TRAZO}/>`), texto: 'Figura a' },
      b: { imagen: figura(`<rect x="30" y="15" width="60" height="60" ${TRAZO}/>`), texto: 'Figura b' },
      c: { imagen: figura(`<polygon points="60,12 95,76 25,76" ${TRAZO}/>`), texto: 'Figura c' },
      d: { imagen: figura(`<polygon points="40,15 80,15 100,45 80,75 40,75 20,45" ${TRAZO}/>`), texto: 'Figura d' } } },
    { clave: 'F17', tema: 'Examen', texto: '¿Qué hace quien aplica el examen antes de entregar el código a una persona?', correcta: 'd', opciones: {
      a: 'Le pide su contraseña de la cuenta para entrar por ella',
      b: 'Le cobra el pago de derechos que tenga pendiente',
      c: 'Le pide que firme el comprobante de recepción de la credencial',
      d: 'Comprueba su identidad con su identificación oficial' } },
    { clave: 'F18', tema: 'Examen', texto: 'Si la computadora falla a mitad del examen, ¿qué pasa con las respuestas?', correcta: 'a', opciones: {
      a: 'Quedan guardadas: se sigue en otra computadora con el mismo código',
      b: 'Se pierden y el examen se presenta otro día con otro pago',
      c: 'Se califican sólo las preguntas contestadas hasta ese momento',
      d: 'Quien aplica el examen las vuelve a capturar desde su equipo' } },
    { clave: 'F19', tema: 'Examen', texto: '¿Se puede cambiar una respuesta ya elegida?', correcta: 'c', opciones: {
      a: 'No: la primera respuesta que se elige es la que cuenta',
      b: 'Sólo una vez por pregunta y con permiso de quien aplica',
      c: 'Sí, todas las veces que se quiera hasta enviar el examen',
      d: 'Sí, incluso después de enviar, durante los 60 minutos' } },
    { clave: 'F20', tema: 'Examen', texto: '¿Cuántas veces sirve el código del examen?', correcta: 'b', opciones: {
      a: 'Para todos los exámenes que presente la persona',
      b: 'Sólo para este examen: al enviarlo deja de servir',
      c: 'Para entrar a la cuenta de la persona durante un año',
      d: 'Para cualquier persona del mismo grupo de curso' } },
    { clave: 'F21', tema: 'Entrega', texto: '¿Cuándo se entrega la credencial a quien aprueba?', correcta: 'a', opciones: {
      a: 'El mismo día del examen, en la sede',
      b: 'Un mes después, en la alcaldía',
      c: 'Cuando la persona la pida por correo',
      d: 'Al renovar la acreditación anterior' } },
    { clave: 'F22', tema: 'Entrega', texto: '¿Qué se hace con la persona el día que recibe su credencial?', correcta: 'd', opciones: {
      a: 'Se le pide de nuevo el pago de derechos del curso',
      b: 'Se le aplica otra vez el examen para confirmar',
      c: 'Se le pide que vuelva a cargar sus documentos',
      d: 'Se le toma la fotografía que lleva la credencial' } },
    { clave: 'F23', tema: 'Trámite', texto: '¿Con qué número se identifica una solicitud?', correcta: 'c', opciones: {
      a: 'Con la CURP de la persona solicitante',
      b: 'Con el número de su acreditación anterior',
      c: 'Con el folio de la solicitud, que empieza con APD-S',
      d: 'Con el número de su teléfono de contacto' } },
    { clave: 'F24', tema: 'Trámite', texto: '¿Quién decide si una carrera es afín para la acreditación de dictaminador?', correcta: 'b', opciones: {
      a: 'La propia persona, al escribir su carrera en la solicitud',
      b: 'El personal de la Secretaría, en la revisión documental',
      c: 'La universidad donde la persona estudió, por escrito',
      d: 'El instructor, el primer día del curso de capacitación' } },

    /* Un caso: varias preguntas sobre el mismo enunciado y la misma tabla, como los ejercicios de valoración y
       restitución del cuadernillo vigente de poda (P105). Salen juntas y en este orden; «orden: 'fijo'» deja las
       opciones como están (escalas de números). La tabla viaja como datos, no como imagen, para que se lea con
       lector de pantalla. */
    { clave: 'F25', tema: 'Caso', caso: 'FC1', texto: '¿Ana tiene derecho a presentar el examen?', correcta: 'a', opciones: {
      a: 'Sí: el curso de primera vez admite una falta',
      b: 'No: el curso de primera vez no admite faltas',
      c: 'Sólo si vuelve a pagar el día que faltó',
      d: 'Sólo si el instructor lo autoriza por escrito' } },
    { clave: 'F26', tema: 'Caso', caso: 'FC1', orden: 'fijo', texto: '¿Qué calificación obtuvo Ana?', correcta: 'b', opciones: { a: '8.0', b: '8.3', c: '8.4', d: '8.5', e: '9.0' } },
    { clave: 'F27', tema: 'Caso', caso: 'FC1', texto: 'Con esa calificación, ¿Ana aprobó?', correcta: 'c', opciones: {
      a: 'No: le falta una décima para la mínima',
      b: 'No: la mínima de dictaminador es 8.5',
      c: 'Sí: la mínima de dictaminador es 8.0',
      d: 'Sí: la mínima de dictaminador es 7.0' } }
  ];

  const casos = {
    FC1: {
      titulo: 'Caso: el examen de Ana',
      enunciado: ['Ana solicitó por primera vez la acreditación de dictaminador técnico. Faltó un día al curso.',
        'En el examen contestó bien 20 de 24 preguntas. La calificación es aciertos ÷ preguntas × 10, con un decimal y sin redondear hacia arriba.'],
      tablas: [{
        titulo: 'Tabla A. Reglas de los cursos (ficticias, sólo para probar)',
        encabezados: ['Curso', 'Días', 'Faltas que se admiten', 'Calificación mínima'],
        filas: [
          ['Poda y derribo · primera vez', '5', '1', '7.0'],
          ['Poda y derribo · renovación', '1', '0', '7.0'],
          ['Dictaminador técnico · primera vez', '5', '1', '8.0'],
          ['Dictaminador técnico · renovación', '1', '0', '8.0']
        ]
      }]
    }
  };

  /* Los exámenes: uno por acreditación, igual para solicitud nueva y renovación (decisiones 2026-10-17, Liber).
     Poda y derribo: el cuadernillo vigente se aplica completo (52 reactivos, 60 minutos); aquí, igual: todas las
     preguntas del banco ficticio. Dictaminador: valores de prueba hasta tener su cuadernillo (P74). */
  const examenes = {
    poda: { preguntas: reactivos.length, minutos: 60 },
    dictaminador: { preguntas: 15, minutos: 60 }
  };
  /* El examen que presenta un curso: el de su tipo (la modalidad ya no cambia el examen) */
  const examenDe = (tipo, modalidad) => examenes[`${tipo}_${modalidad}`] || examenes[tipo];

  global.APD_EXAMEN_BANCO = { ficticio: true, reactivos, casos, examenes, examenDe };
}(typeof window !== 'undefined' ? window : globalThis));
