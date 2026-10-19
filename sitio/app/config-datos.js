/* =========================================================
   config-datos.js · Guardado de «Mi perfil» (decisiones 2026-10-15 y 2026-10-17)

   La página tiene un formulario por parte: contacto, adscripción y fotografía. app/datos.js arranca cada uno a
   mano (data-formkit="manual") y le pasa APD_PERFIL.guarda(parte, payload, { signal }).
   El envío es una SIMULACIÓN: guarda los cambios sólo en este navegador (app/archivos-prueba.js; APD.cargar los
   aplica encima de los datos ficticios), también la fotografía nueva. En la
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
          // La sesión sigue siendo la de quien abrió la página (auditoría «intentar romperlo», F1 1 y 2: «Mi perfil» de una
          // persona se guardaba en la cuenta de quien entró en otra pestaña, o sin cuenta). La API comparará la sesión con la
          // persona que la página espera (409).
          const sesion = APD.sesionCambio();
          if (sesion) return mal(sesion);
          const p = APD.personaDeSesion(datos);
          if (!p) return mal(APD.rechazo('Tu cuenta no está activa', 'No se guardó nada. Vuelve a entrar; si no puedes, pide ayuda a la Secretaría.', { href: 'entrar.html', texto: 'Entrar' }, 'sesion_cambio'));
          const P = typeof APD_ARCHIVOS_PRUEBA !== 'undefined' ? APD_ARCHIVOS_PRUEBA : null;
          if (!P) return mal(new Error('sin almacenamiento'));
          // Se guarda en este navegador, por persona: lo ven «Mi perfil», las solicitudes nuevas y el personal
          let guarda = Promise.resolve();
          // Un correo, una cuenta (decisión 2026-10-17): el de otra cuenta activa no se acepta
          if (parte === 'contacto' && APD.correoEnUso(datos, d.correo, p)) {
            return mal({ mensaje: APD.CORREO_EN_USO, errores: [{ campo: 'correo', mensaje: APD.CORREO_EN_USO }] });
          }
          // Si el navegador no lo guarda (modo privado, almacenamiento bloqueado o lleno), se dice y no se da por guardado
          // (auditoría «intentar romperlo», F4 A8: «Se guardó tu contacto» con el teléfono anterior debajo)
          const QUE = { contacto: 'tu contacto', adscripcion: 'tu adscripción', foto: 'tu fotografía' };
          const noGuardo = () => mal(APD.noGuardo('No se guardó', QUE[parte] || 'tus cambios'));
          const foto = parte === 'foto' ? (payload.archivos || []).find((a) => a.campo === 'foto' && a.blob) : null;
          if (parte === 'contacto' && !P.guardaPerfil(p.id, { correo: d.correo, telefono: d.telefono })) return noGuardo();
          if (parte === 'adscripcion' && !P.guardaPerfil(p.id, APD.adscripcionDe(datos, d))) return noGuardo();
          // La fotografía primero y después la marca de «fotografía nueva»: sin la fotografía guardada, no queda la marca
          if (foto) guarda = P.guardaFoto(p.curp, foto);
          return guarda.then(() => {
            if (parte === 'foto' && !P.guardaPerfil(p.id, { foto_nueva: true })) return noGuardo();
            return ok({ parte, fecha: new Date().toISOString() });
          }, noGuardo);
        }).catch(mal);
      }, modo === 'lento' ? 20000 : 400);
      signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
    });
  }
};
