/* =========================================================
   examen-ficticio.js · Banco de reactivos FICTICIO para probar el examen en línea

   NO ES EL EXAMEN REAL. Son 10 preguntas de cultura general, todas de opción
   múltiple con cuatro opciones de texto (a–d), sólo para probar la interfaz:
   una pregunta por pantalla, orden al azar de preguntas y opciones, reloj,
   mapa de preguntas, revisión, envío, calificación y constancia. El examen
   real y su página se construyen después (decisión de Liber, 18/10/2026).

   El banco real, con su clave de respuestas, nunca entra a este repositorio
   público (P85): se carga directo en la base del SIA y la página nunca recibe
   la respuesta correcta.

   Las opciones de cada pregunta tienen un largo parecido y la correcta se
   reparte entre las cuatro letras, para que no se adivine por la forma (P74).

   Parámetros de prueba: los dos exámenes (poda y derribo, dictaminador
   técnico) con 10 preguntas y 60 minutos.
   ========================================================= */
(function (global) {
  'use strict';

  const reactivos = [
    { clave: 'F01', tema: 'Astronomía', texto: '¿Cuántos planetas tiene el sistema solar?', correcta: 'a', opciones: {
      a: 'Ocho planetas', b: 'Siete planetas', c: 'Nueve planetas', d: 'Diez planetas' } },
    { clave: 'F02', tema: 'Geografía', texto: '¿Cuál es el océano más grande del planeta?', correcta: 'b', opciones: {
      a: 'El océano Atlántico', b: 'El océano Pacífico', c: 'El océano Índico', d: 'El océano Ártico' } },
    { clave: 'F03', tema: 'Matemáticas', texto: '¿Cuántos lados tiene un hexágono?', correcta: 'c', opciones: {
      a: 'Cinco lados', b: 'Siete lados', c: 'Seis lados', d: 'Ocho lados' } },
    { clave: 'F04', tema: 'Ciencia', texto: '¿A qué temperatura hierve el agua al nivel del mar?', correcta: 'd', opciones: {
      a: 'A 80 grados Celsius', b: 'A 90 grados Celsius', c: 'A 110 grados Celsius', d: 'A 100 grados Celsius' } },
    { clave: 'F05', tema: 'Calendario', texto: '¿Cuántos días tiene un año bisiesto?', correcta: 'a', opciones: {
      a: '366 días', b: '365 días', c: '364 días', d: '367 días' } },
    { clave: 'F06', tema: 'Cuerpo humano', texto: '¿Qué órgano del cuerpo humano bombea la sangre a todo el cuerpo?', correcta: 'b', opciones: {
      a: 'El hígado', b: 'El corazón', c: 'El pulmón', d: 'El riñón' } },
    { clave: 'F07', tema: 'Matemáticas', texto: '¿Cuántos minutos hay en una hora y media?', correcta: 'c', opciones: {
      a: '60 minutos', b: '80 minutos', c: '90 minutos', d: '120 minutos' } },
    { clave: 'F08', tema: 'Animales', texto: '¿Cuál es el animal terrestre más grande que existe hoy?', correcta: 'd', opciones: {
      a: 'La jirafa', b: 'El rinoceronte', c: 'El hipopótamo', d: 'El elefante' } },
    { clave: 'F09', tema: 'Geografía', texto: '¿En qué continente está Egipto?', correcta: 'b', opciones: {
      a: 'En Asia', b: 'En África', c: 'En Europa', d: 'En Oceanía' } },
    { clave: 'F10', tema: 'Ciencia', texto: 'Según la división tradicional, ¿cuántos colores tiene el arcoíris?', correcta: 'c', opciones: {
      a: 'Cinco colores', b: 'Seis colores', c: 'Siete colores', d: 'Ocho colores' } }
  ];

  /* Los exámenes: uno por acreditación, igual para solicitud nueva y renovación (decisiones 2026-10-17, Liber).
     Versión de prueba: los dos con las 10 preguntas del banco ficticio y 60 minutos. */
  const examenes = {
    poda: { preguntas: 10, minutos: 60 },
    dictaminador: { preguntas: 10, minutos: 60 }
  };
  /* El examen que presenta un curso: el de su tipo (la modalidad ya no cambia el examen) */
  const examenDe = (tipo, modalidad) => examenes[`${tipo}_${modalidad}`] || examenes[tipo];

  global.APD_EXAMEN_BANCO = { ficticio: true, reactivos, examenes, examenDe };
}(typeof window !== 'undefined' ? window : globalThis));
