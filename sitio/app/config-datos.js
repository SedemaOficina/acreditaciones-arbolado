/* =========================================================
   config-datos.js · Ajustes del formulario «Mis datos»

   Se carga ANTES que el núcleo. El envío es una SIMULACIÓN: guarda los cambios en la sesión de esta pestaña
   (APD.personaDeSesion los aplica encima de los datos ficticios). En la etapa 3 se sustituye por
   PATCH /apd/cuenta, que vuelve a validar todo con codigo/servidor/validar.mjs y el esquema derivado de
   datos.html, y actualiza apd.solicitante: correo, teléfono y adscripción (convertida con el mismo criterio
   que APD.adscripcionDe; la base registra el cambio en la bitácora). La fotografía nueva, si viene, entra a
   apd.fotografia (la base la rechaza si ya está confirmada).
   ?simular=error | limite | lento muestra cada pantalla de fallo.
   ========================================================= */
window.FORMKIT_OPCIONES = {
  enviar(payload, { signal }) {
    const modo = new URLSearchParams(location.search).get('simular');
    return new Promise((ok, mal) => {
      const t = setTimeout(() => {
        if (modo === 'limite') return mal({ limite: true });
        if (modo === 'error') return mal(new Error('simulado'));
        APD.cargar().then((datos) => {
          const d = payload.datos;
          const sesion = APD.leeSesion() || {};
          const adscripcion = APD.adscripcionDe(datos, d);
          sesion.datos = Object.assign({}, sesion.datos, { correo: d.correo, telefono: d.telefono }, adscripcion);
          if ((payload.archivos || []).some((a) => a.campo === 'foto')) sesion.datos.foto_nueva = true;
          APD.guardaSesion(sesion);
          ok({ folio: APD.ADSCRIPCIONES[adscripcion.adscripcion] + (adscripcion.organizacion_nombre ? ` · ${adscripcion.organizacion_nombre}` : ''), fecha: new Date().toISOString() });
        }).catch(mal);
      }, modo === 'lento' ? 20000 : 400);
      signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
    });
  }
};
