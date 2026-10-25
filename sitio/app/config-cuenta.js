/* =========================================================
   config-cuenta.js · Ajustes del formulario «Crea tu cuenta»

   Se carga ANTES que el núcleo (contrato del estándar). El envío es una
   SIMULACIÓN sobre los datos ficticios: en la etapa 3 se sustituye por
   POST /apd/cuentas, que vuelve a validar todo con
   codigo/servidor/validar.mjs y el esquema derivado de cuenta.html, guarda
   la contraseña derivada con scrypt y nunca la devuelve.

   La CURP ya llegó comprobada contra el nombre, los apellidos y la fecha
   de nacimiento (validaciones cruzadas). Eso prueba coherencia, no
   identidad: la identidad la confirma la identificación oficial en el
   cotejo presencial y, si se decide, la consulta a RENAPO [pendiente].

   Adscripción: la API la convierte con el mismo criterio que APD.adscripcionDe (clave del catálogo o nombre
   escrito) y la guarda en apd.solicitante. El sexo no se recibe: la base lo toma de la CURP.

   Respuestas del servidor que la pantalla ya contempla:
     · CURP con cuenta activa      → rechazo con mensaje (no se crea otra);
     · CURP del padrón migrado     → si el nombre es el del registro, se activa esa cuenta y se
                                     muestra su historial; si no, se rechaza;
     · CURP del registro asistido  → la cuenta que registró la Secretaría en el Vivero sin contraseña
       (decisión 2026-10-25): el mismo camino que el padrón migrado (CURP y nombre); al activarla
       la persona pone su correo (obligatorio) y su contraseña y ve lo que se capturó por ella. La
       base pone la hora de la activación (activada_en). Si su fotografía ya está confirmada en el
       cotejo, la API conserva ésa y no guarda la nueva (la base no deja cambiarla: foto_confirmada);
     · CURP nueva                  → cuenta nueva.
   ?simular=error | limite | lento muestra cada pantalla de fallo.
   ========================================================= */
/* Las cruzadas CURP ↔ nombre, apellidos y fecha (curp-nombre, curp-segundo-apellido, curp-fecha-dma) y el formato
   fecha-dma son del estándar desde la 1.1.0 y la 1.2.0: no hay nada que configurar. */
// El acuse ya escribe la hora en 24 horas y en la zona de la Ciudad (estándar 1.4.2, P128): no hay nada que configurar.
window.FORMKIT_CONFIG = {};
/* Nombre comparable con el registro anterior: mayúsculas, sin acentos ni signos. */
const limpiaNombre = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
/* Letras distintas entre dos textos (distancia de edición: cambiar, sobrar o faltar una letra cuenta 1) */
function distancia(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    for (let j = 1; j <= b.length; j++) fila[j] = Math.min(prev[j] + 1, fila[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = fila;
  }
  return prev[b.length];
}
/* Activar una cuenta del registro anterior (P14, decisión 2026-10-18): la CURP ya coincide; el nombre completo se
   compara sin acentos ni signos y admite una letra distinta. La identidad se confirma en el cotejo, con la
   identificación oficial. */
const nombreCompleto = (p) => limpiaNombre([p.nombre, p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' '));
const coincideConRegistro = (d, e) => distancia(nombreCompleto(d), nombreCompleto(e)) <= 1;

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
          const asistida = APD.asistidaSinActivar(existente);
          if (existente && existente.estado !== 'sin_activar' && !asistida) {
            return mal({ mensaje: 'Ya hay una cuenta con esta CURP. Entra con ella; si no recuerdas tu contraseña, pide ayuda a la Secretaría.' });
          }
          // Un correo, una cuenta: el de otra cuenta activa no se acepta (decisión 2026-10-17)
          if (APD.correoEnUso(datos, d.correo, { curp: d.curp })) {
            return mal({ mensaje: APD.CORREO_EN_USO, errores: [{ campo: 'correo', mensaje: APD.CORREO_EN_USO }] });
          }
          if (existente) {
            // Registro anterior (Kobo) o registro asistido: además de la CURP, el nombre, con una letra de tolerancia (P14)
            if (!coincideConRegistro(d, existente)) {
              const NO = 'No coincide con el nombre que tiene la Secretaría para esta CURP.';
              return mal({ mensaje: `Tu nombre no coincide con el que tiene la Secretaría para esta CURP ${asistida ? 'en la cuenta que registró en el Vivero' : 'en su registro anterior'}. Revisa tu nombre y tus apellidos; si están bien escritos, acude a la Secretaría para aclararlo: informes de lunes a viernes, de 9:00 a 15:00 (parámetro informes_horario). Pendiente: teléfono y correo para estas aclaraciones (P132).`,
                errores: [{ campo: 'nombre', mensaje: NO }, { campo: 'primer_apellido', mensaje: NO }] });
            }
          }
          // Versión de prueba: la cuenta (con la contraseña sólo como resumen) y la fotografía se guardan en este
          // navegador, para entrar otra vez, verla en «Mi perfil» y en la revisión del personal (app/archivos-prueba.js)
          const id = existente ? existente.id : `prueba:${d.curp}`;
          const P = typeof APD_ARCHIVOS_PRUEBA !== 'undefined' ? APD_ARCHIVOS_PRUEBA : null;
          // La del registro asistido conserva lo que capturó la Secretaría (quién la registró y cuándo; en la prueba, también
          // su nombre, si se registró en este navegador) y anota cuándo se activó (como la base, activada_en)
          const deAsistida = asistida ? Object.assign(existente.de_prueba ? { nombre: existente.nombre, primer_apellido: existente.primer_apellido,
            segundo_apellido: existente.segundo_apellido || null, sexo: existente.sexo } : {},
          { registro_asistido_por: existente.registro_asistido_por, registro_asistido_en: existente.registro_asistido_en,
            activada_en: P ? P.alCorte(datos, new Date().toISOString()) : new Date().toISOString() }) : {};
          const persona = Object.assign(existente ? {} : { nombre: d.nombre, primer_apellido: d.primer_apellido, segundo_apellido: d.segundo_apellido || null, sexo: d.curp[10] },
            deAsistida, { correo: d.correo, telefono: d.telefono }, APD.adscripcionDe(datos, d));
          const foto = (payload.archivos || []).find((a) => a.campo === 'foto' && a.blob);
          // Si el navegador no deja guardar (modo privado, almacenamiento bloqueado), se dice ahora: si no, la cuenta parece
          // creada y después no se puede entrar con ella (2026-10-17)
          const guarda = P ? Promise.all([P.guardaCuenta({ curp: d.curp, id, persona, contrasena: d.contrasena }), foto ? P.guardaFoto(d.curp, foto) : null])
            .then(() => P.cuenta(d.curp)) : Promise.resolve(true);
          guarda.then((guardada) => {
            if (!guardada) throw new Error('sin cuenta guardada');
            // La sesión también: si no se guarda, el acuse decía «cuenta creada» y «Mis trámites» mandaba a «Entrar» sin
            // decir por qué (auditoría «intentar romperlo», F4 M1)
            if (!APD.guardaSesion({ id })) {
              return mal({ mensaje: `Tu cuenta de prueba quedó guardada, pero ${APD.textoNoGuardo('tu sesión').replace(/^Este/, 'este')}` });
            }
            return ok({ folio: d.curp, fecha: new Date().toISOString(), historial: Boolean(existente), asistida });
          }).catch(() => mal({ mensaje: APD.textoNoGuardo('tu cuenta de prueba') }));
        }).catch(mal);
      }, modo === 'lento' ? 20000 : 400);
      signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
    });
  },
  alEnviar(respuesta) {
    const h = document.querySelector('[data-cuenta-historial]');
    if (h) h.hidden = !respuesta.historial;
    // Registro asistido: lo que capturó la Secretaría en el Vivero ya está en su cuenta
    if (h && respuesta.asistida) h.textContent = 'Tu cuenta ya tiene lo que la Secretaría capturó contigo en el Vivero: lo verás en «Mis trámites».';
    // Con la cuenta creada, la barra de pasos ya no dice nada (el acuse ocupa el lugar del formulario)
    const barra = document.querySelector('[data-con-formulario]');
    if (barra) barra.hidden = true;
  },
  alFallar(error, form) {
    // El núcleo ya mostró el aviso general de fallo y pintó junto a su campo los errores que devolvió el servidor
    // ({ errores }, estándar 1.3.1, P86); si el servidor dio un motivo general, se dice ese.
    const aviso = form.querySelector('[data-estado-envio] .aviso-texto');
    if (error && error.mensaje && aviso) aviso.textContent = error.mensaje;
  }
};
