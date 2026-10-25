/* =========================================================
   config-asistido.js · Ajustes del formulario «Registro asistido» (personal)

   Se carga ANTES que el núcleo (contrato del estándar). Registro asistido (decisión de Liber del 25/10/2026): el
   personal de revisión y cotejo registra en el Vivero, con la persona presente, a quien no sabe leer ni escribir.
   El envío es una SIMULACIÓN sobre los datos ficticios: en la etapa 3 se sustituye por POST /apd/cuentas-asistidas, que
   vuelve a validar todo con codigo/servidor/validar.mjs y el esquema derivado de asistido.html, y en la base declara la
   cuenta y el perfil del personal (apd.usuario, apd.perfil) y la marca «se le leyó el aviso de privacidad»
   (apd.lectura_aceptada = aviso_privacidad). La base crea la cuenta activa y SIN contraseña (registro_asistido_por y
   registro_asistido_en los pone ella), carga la fotografía como del registro asistido (pendiente hasta el cotejo) y deja
   la marca en la bitácora. Sólo el perfil de revisión y cotejo puede hacerlo (registro_asistido_sin_permiso).

   Respuestas del servidor que la pantalla ya contempla:
     · CURP con cuenta (activa, del registro asistido o del padrón migrado) → rechazo con mensaje: se busca a la persona
       en la ventanilla (el caso del padrón migrado está por decidir, P208);
     · correo de otra cuenta activa → rechazo junto al campo (un correo, una cuenta);
     · menor de edad → lo rechaza antes la cruzada «curp-mayoria-edad» (app/cruzadas-propias.js) y, si no, la base.
   ?simular=error | limite | lento muestra cada pantalla de fallo.
   ========================================================= */
window.FORMKIT_CONFIG = {
  // La mayoría de edad con la fecha de la CURP (cruzada propia; la del estándar no lee la fecha día/mes/año)
  cruzadas: window.APD_CRUZADAS,
  // «pesa 5.0 MB y el máximo es 5 MB» parecía que sí cabía (redondeo del estándar; F4 B6)
  mensajes: { archRechazoPeso: 'pasa del máximo de {mb} MB (pesa {peso}). Reduzca su tamaño o elija otra.' }
};

window.FORMKIT_OPCIONES = {
  enviar(payload, { signal }) {
    const modo = new URLSearchParams(location.search).get('simular');
    return new Promise((ok, mal) => {
      const t = setTimeout(() => {
        if (modo === 'limite') return mal({ limite: true });
        if (modo === 'error') return mal(new Error('simulado'));
        APD.cargar().then((datos) => {
          const d = payload.datos;
          const existente = datos.solicitante.find((p) => p.curp === d.curp);
          const aVentanilla = { href: `ventanilla.html?buscar=${encodeURIComponent(d.curp)}`, texto: 'Buscarla en la ventanilla' };
          if (existente && existente.estado === 'sin_activar') {
            return mal(APD.rechazo('No se registró la cuenta', 'Esta CURP está en el registro anterior de la Secretaría (Kobo). Cómo se registra con ayuda a una persona del registro anterior está por decidir (P208).', aVentanilla, 'curp_del_padron'));
          }
          if (existente) {
            return mal(APD.rechazo('No se registró la cuenta', 'Ya hay una cuenta con esta CURP. Busque a la persona en la ventanilla para ver en qué va su trámite.', aVentanilla, 'curp_registrada'));
          }
          // Un correo, una cuenta (decisión 2026-10-17): el correo es opcional, pero si se da no puede ser el de otra cuenta
          if (d.correo && APD.correoEnUso(datos, d.correo, { curp: d.curp })) {
            const m = 'Este correo ya está registrado en otra cuenta. Escriba otro o déjelo vacío.';
            return mal(APD.rechazo('No se registró la cuenta', m, null, 'correo_registrado', [{ campo: 'correo', mensaje: m }]));
          }
          const P = typeof APD_ARCHIVOS_PRUEBA !== 'undefined' ? APD_ARCHIVOS_PRUEBA : null;
          const R = window.APD_PERSONAL ? window.APD_PERSONAL.REVISORA : { usuario: 'revision.prueba' };
          const ahora = new Date().toISOString();
          const en = P ? P.alCorte(datos, ahora) : ahora;
          const id = `prueba:${d.curp}`;
          // Versión de prueba: la cuenta (sin contraseña) y la fotografía se guardan en este navegador; la marca del aviso de
          // privacidad, con la cuenta: { por, en } (en la base, la bitácora)
          const persona = Object.assign({ nombre: d.nombre, primer_apellido: d.primer_apellido, segundo_apellido: d.segundo_apellido || null, sexo: d.curp[10],
            correo: d.correo || null, telefono: d.telefono, registro_asistido_por: R.usuario, registro_asistido_en: en, activada_en: null,
            lectura_aviso_privacidad: { por: R.usuario, en } }, APD.adscripcionDe(datos, d));
          const foto = (payload.archivos || []).find((a) => a.campo === 'foto' && a.blob);
          const guarda = P ? Promise.all([P.guardaCuenta({ curp: d.curp, id, persona, contrasena: null }), foto ? P.guardaFoto(d.curp, foto) : null]).then(() => P.cuenta(d.curp))
            : Promise.resolve(true);
          guarda.then((guardada) => {
            if (!guardada) throw new Error('sin cuenta guardada');
            return ok({ folio: d.curp, fecha: en, id });
          }).catch(() => mal(APD.noGuardo('No se registró la cuenta', 'la cuenta de prueba', 'usted')));
        }).catch(mal);
      }, modo === 'lento' ? 20000 : 400);
      signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
    });
  },
  alEnviar(respuesta) {
    // Al terminar sigue directo a capturar su solicitud (decisión de Liber del 25/10/2026)
    const barra = document.querySelector('[data-con-formulario]');
    if (barra) barra.hidden = true;
    const destino = `solicitud.html?asistida=${encodeURIComponent(respuesta.id)}`;
    const a = document.querySelector('[data-ir-solicitud]');
    if (a) a.setAttribute('href', destino);
    window.location.assign(destino);
  },
  alFallar(e, form) { APD.muestraRechazo(e, form); }
};
