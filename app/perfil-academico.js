/* perfil-academico.js · Perfil del dictaminador y experiencia mínima que pide

   El mismo cálculo que apd.perfil_academico y apd.experiencia_minima en la base (decisión 2026-10-15). Sin
   dependencias del navegador: lo usan la página (APD.perfilAcademico y el mínimo de «Experiencia en manejo de
   arbolado», FORMKIT_CONFIG.limitesSegun.experiencia) y el servidor (validaPayload(…, { limitesSegun }),
   herramientas/probar-esquemas.mjs), así que la regla es una sola (estándar 1.1.0, P61).

   perfilAcademico(datos, nivel, estatus, carrera) → { perfil, minimo } o null si aún faltan respuestas.
   minimoExperiencia(catalogo, respuestas) → años que se piden (0 mientras el perfil no esté completo: la
   Secretaría lo revisa). `catalogo` trae la lista de carreras (apd.carrera). */
(function (global) {
  'use strict';
  /* Mismo criterio que apd.normalizar en la base: sin acentos, minúsculas, sólo letras, números y espacios. */
  const normaliza = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const BASICOS = ['ninguna', 'preescolar', 'primaria', 'secundaria', 'preparatoria'];
  const SUPERIORES = ['licenciatura', 'maestria', 'doctorado'];
  const MINIMOS = { licenciatura_afin: 2, disciplina_afin: 5, pasante: 5, tecnica: 5 };
  function perfilAcademico(datos, nivel, estatus, carrera) {
    if (!nivel) return null;
    let perfil;
    if (BASICOS.includes(nivel)) perfil = 'no_cumple';
    else if (nivel === 'tecnica') perfil = 'tecnica';
    else if (!estatus) return null;
    else if (nivel === 'licenciatura' && ['en_curso', 'trunco'].includes(estatus)) perfil = 'no_cumple';
    else {
      if (!normaliza(carrera)) return null;
      const c = ((datos && datos.carrera) || []).find((x) => x.nombre_normalizado === normaliza(carrera));
      const grupo = c ? c.grupo : null;
      if (!grupo) perfil = 'por_clasificar';
      else if (grupo === 'no_afin') perfil = 'no_cumple';
      else if (nivel === 'licenciatura' && estatus === 'concluido') perfil = 'pasante';
      else perfil = ['principal', 'afin'].includes(grupo) ? 'licenciatura_afin' : 'disciplina_afin';
    }
    return { perfil, minimo: MINIMOS[perfil] || 5 }; // lo que decide el personal también pide 5 (decisión 2026-10-15)
  }
  /* Respuestas del formulario de solicitud → mínimo de años de experiencia. */
  function minimoExperiencia(catalogo, r) {
    const superior = SUPERIORES.includes(r.nivel_estudios);
    const p = perfilAcademico(catalogo, r.nivel_estudios, superior ? r.estatus_estudios || '' : '', superior ? r.carrera || '' : '');
    return p && p.minimo ? p.minimo : 0;
  }
  global.APD_PERFIL_ACADEMICO = { perfilAcademico, minimoExperiencia, normaliza, SUPERIORES, BASICOS, MINIMOS };
}(typeof window !== 'undefined' ? window : globalThis));
