/* =========================================================
   config-datos.js · Guardado de «Mi perfil» (decisiones 2026-10-15 y 2026-10-17)

   La página tiene un formulario por parte: contacto, adscripción y fotografía. app/datos.js arranca cada uno a
   mano (data-formkit="manual") y le pasa APD_PERFIL.guarda(parte, payload, { signal }).
   El envío es una SIMULACIÓN: guarda los cambios en la sesión de esta pestaña (APD.personaDeSesion los aplica
   encima de los datos ficticios) y la fotografía nueva sólo en este navegador (app/archivos-prueba.js). En la
   etapa 3 se sustituye por la API, que vuelve a validar cada parte con codigo/servidor/validar.mjs y su esquema
   (db/esquemas-formularios/perfil-contacto.json, perfil-adscripcion.json, perfil-foto.json) y actualiza
   apd.solicitante: correo y teléfono; adscripción (convertida con el mismo criterio que APD.adscripcionDe; la base
   registra el cambio en la bitácora); la fotografía entra a apd.fotografia (la base la rechaza si ya está
   confirmada).
   ?simular=error | limite | lento muestra cada pantalla de fallo.
   ========================================================= */
window.APD_PERFIL = {
  guarda(parte, payload, { signal }) {
    const modo = new URLSearchParams(location.search).get('simular');
    return new Promise((ok, mal) => {
      const t = setTimeout(() => {
        if (modo === 'limite') return mal({ limite: true, mensaje: 'Hiciste demasiados cambios seguidos. Espera unos minutos e intenta de nuevo.' });
        if (modo === 'error') return mal(new Error('simulado'));
        APD.cargar().then((datos) => {
          const d = payload.datos;
          const sesion = APD.leeSesion() || {};
          const p = APD.personaDeSesion(datos) || {};
          sesion.datos = Object.assign({}, sesion.datos);
          let guarda = Promise.resolve();
          if (parte === 'contacto') Object.assign(sesion.datos, { correo: d.correo, telefono: d.telefono });
          if (parte === 'adscripcion') Object.assign(sesion.datos, APD.adscripcionDe(datos, d));
          if (parte === 'foto') {
            sesion.datos.foto_nueva = true;
            const foto = (payload.archivos || []).find((a) => a.campo === 'foto' && a.blob);
            if (foto && typeof APD_ARCHIVOS_PRUEBA !== 'undefined') guarda = APD_ARCHIVOS_PRUEBA.guardaFoto(p.curp, foto).catch(() => {});
          }
          APD.guardaSesion(sesion);
          guarda.then(() => ok({ parte, fecha: new Date().toISOString() }));
        }).catch(mal);
      }, modo === 'lento' ? 20000 : 400);
      signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
    });
  }
};
