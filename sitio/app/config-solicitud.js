/* =========================================================
   config-solicitud.js · Ajustes del formulario de solicitud (por pasos)

   Se carga ANTES que el núcleo. Sólo lo que cambia respecto de
   validaciones.config.js:
     · archivos: 5 MB por archivo (parámetro tamano_maximo_archivo_bytes de
       la base) y sólo PDF, JPG y PNG (los tipos que admite apd.documento).
   El catálogo de alcaldías lo da datos/catalogos.js (generado de apd.organizacion).

   Adscripción (decisiones 2026-10-15). La API convierte las respuestas en solicitud.adscripcion y
   solicitud.organizacion_id (catálogo apd.organizacion, buscado por clave o, si es un nombre escrito, por
   nombre normalizado; si no existe, lo agrega con su tipo):
     · adscrito = no                                   → sin adscripción ni institución;
     · privada + empresa_nombre                        → institución «privada» con ese nombre;
     · dependencia_cdmx = sobse | paot                 → la de esa clave;
     · dependencia_cdmx = sedema + direccion_sedema    → clave sedema_<siglas>; «otro» → «SEDEMA · <nombre>»;
     · dependencia_cdmx = otro + dependencia_cdmx_otra → institución con ese nombre;
     · alcaldia                                        → la de ese nombre (catálogo cerrado);
     · dependencia_federal = cfe | otro (+ nombre)     → la de clave cfe o la del nombre escrito.

   El envío es una SIMULACIÓN: asigna un folio con la forma de la base
   (APD-S-AAAA-NNNNN) y no guarda nada fuera de esta pestaña. En la etapa 3
   se sustituye por la API del proyecto: crea la solicitud en borrador,
   sube cada documento, la pasa a «enviada» y la base aplica sus reglas
   (elegibilidad, documentos obligatorios, perfil). El servidor revalida
   todo con codigo/servidor/validar.mjs y el esquema derivado de
   solicitud.html.
   ?simular=error | limite | lento muestra cada pantalla de fallo.
   ========================================================= */
window.FORMKIT_CONFIG = {
  archivos: { mb: 5, extensiones: ['pdf', 'jpg', 'jpeg', 'png'], max: 1 }
};

window.FORMKIT_OPCIONES = {
  enviar(payload, { signal }) {
    const modo = new URLSearchParams(location.search).get('simular');
    return new Promise((ok, mal) => {
      const t = setTimeout(() => {
        if (modo === 'limite') return mal({ limite: true });
        if (modo === 'error') return mal(new Error('simulado'));
        APD.cargar().then((datos) => {
          const sesion = APD.leeSesion() || {};
          const propias = sesion.solicitudes || [];
          const d = payload.datos;
          // El curso no viaja (campo auxiliar): el servidor lo determina del tipo y del historial
          const [tipo, modalidad] = document.getElementById('tramite').value.split('_');
          const continua = new URLSearchParams(location.search).get('folio');
          const ahora = new Date().toISOString();
          let folio = continua;
          if (!continua) {
            const n = datos.solicitud.length + propias.length + 1;
            folio = `APD-S-${datos.fecha_corte.slice(0, 4)}-${String(n).padStart(5, '0')}`;
            propias.unshift({ folio, tipo_acreditacion: tipo, modalidad, estado: 'enviada', enviada_en: ahora, creada_en: ahora, id: `sesion-${n}` });
          } else {
            sesion.reenviadas = (sesion.reenviadas || []).concat(continua);
          }
          sesion.solicitudes = propias;
          APD.guardaSesion(sesion);
          ok({ folio, fecha: ahora });
        }).catch(mal);
      }, modo === 'lento' ? 20000 : 400);
      signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
    });
  }
};
