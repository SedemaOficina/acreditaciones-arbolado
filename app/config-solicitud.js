/* =========================================================
   config-solicitud.js · Ajustes del formulario de solicitud (por pasos)

   Se carga ANTES que el núcleo. Sólo lo que cambia respecto de
   validaciones.config.js:
     · archivos: 5 MB por archivo (parámetro tamano_maximo_archivo_bytes de
       la base) y sólo PDF (apd.requisito.formatos de lo que carga la persona; decisión 2026-10-15).
   Los catálogos de empresas y carreras los da datos/catalogos.js (generado de apd.organizacion y apd.carrera).

   Adscripción (decisiones 2026-10-15). La API convierte las respuestas en solicitud.adscripcion y
   solicitud.organizacion_id (catálogo apd.organizacion, buscado por clave o, si es un nombre escrito, por
   nombre normalizado; si no existe, lo agrega con su tipo):
     · adscrito = no                                   → sin adscripción ni institución;
     · privada + empresa_nombre                        → institución «privada» con ese nombre;
     · dependencia_cdmx = sobse | paot                 → la de esa clave;
     · dependencia_cdmx = sedema + direccion_sedema    → clave sedema_<siglas> (lista cerrada);
     · dependencia_cdmx = otro + dependencia_cdmx_otra → institución con ese nombre;
     · alcaldia                                        → la de esa clave (lista de las 16);
     · dependencia_federal = cfe | otro (+ nombre)     → la de clave cfe o la del nombre escrito;
     · educativa = unam | otro (+ nombre)              → la de clave unam o la del nombre escrito.
   Estudios, en los dos tipos: nivel_estudios; con licenciatura o posgrado, carrera y estatus_estudios; con carrera
   técnica, carrera_tecnica (escrita, sin catálogo).
   Van tal cual; en dictaminador la base calcula
   perfil_academico y experiencia_minima (apd.perfil_academico) y liga la carrera a apd.carrera.

   El envío es una SIMULACIÓN: asigna un folio con la forma de la base
   (APD-S-AAAA-NNNNN) y no guarda nada fuera de esta pestaña. En la etapa 3
   se sustituye por la API del proyecto: crea la solicitud en borrador,
   sube cada documento, la pasa a «enviada» y la base aplica sus reglas
   (elegibilidad, documentos obligatorios, perfil). El servidor revalida
   todo con codigo/servidor/validar.mjs y el esquema derivado de
   solicitud.html.
   ?simular=error | limite | lento muestra cada pantalla de fallo.
   ========================================================= */
/* Experiencia mínima según el perfil (data-min-segun="experiencia", estándar 1.1.0, P61): la misma regla en la
   página y en el servidor (app/perfil-academico.js). El catálogo de carreras llega cuando la página carga los datos
   (APD_SOLICITUD.usaCatalogo); antes, el mínimo es 0. */
let catalogoCarreras = null;
window.APD_SOLICITUD = { usaCatalogo(datos) { catalogoCarreras = datos; } };
window.FORMKIT_CONFIG = {
  archivos: { mb: 5, extensiones: ['pdf'], max: 1 },
  limitesSegun: { experiencia: (r) => APD_PERFIL_ACADEMICO.minimoExperiencia(catalogoCarreras, r) }
};

const global_archivos = () => typeof APD_ARCHIVOS_PRUEBA !== 'undefined';

window.FORMKIT_OPCIONES = {
  enviar(payload, { signal }) {
    const modo = new URLSearchParams(location.search).get('simular');
    return new Promise((ok, mal) => {
      const t = setTimeout(() => {
        if (modo === 'limite') return mal({ limite: true });
        if (modo === 'error') return mal(new Error('simulado'));
        APD.cargar().then((datos) => {
          const d = payload.datos;
          // El curso no viaja (campo auxiliar): el servidor lo determina del tipo y del historial
          const [tipo, modalidad] = document.getElementById('tramite').value.split('_');
          const continua = new URLSearchParams(location.search).get('folio');
          const ahora = new Date().toISOString();
          let folio = continua;
          if (!continua) {
            // datos ya trae lo enviado antes en este navegador (APD.cargar): el folio no se repite
            const n = datos.solicitud.length + 1;
            folio = `APD-S-${datos.fecha_corte.slice(0, 4)}-${String(n).padStart(5, '0')}`;
          }
          // Versión de prueba: los archivos reales y un resumen de la solicitud se guardan sólo en este navegador, para
          // verlos en la revisión del personal (app/archivos-prueba.js). Si el navegador no lo permite, el envío sigue igual.
          const prefijo = `doc_${tipo}_${modalidad}_`;
          const archivos = (payload.archivos || []).filter((a) => a.campo.startsWith(prefijo) && a.blob)
            .map((a) => ({ requisito: a.campo.slice(prefijo.length), blob: a.blob, nombre: a.nombre, tipo: a.tipo, size: a.size }));
          const previa = continua ? datos.solicitud.find((x) => x.folio === continua) : null;
          const p = APD.personaDeSesion(datos) || {};
          const ant = d.anterior ? datos.acreditacion.find((a) => a.numero === d.anterior) : null;
          const registro = {
            folio, existente: Boolean(previa), tipo_acreditacion: tipo, modalidad,
            acreditacion_anterior_id: ant ? ant.id : (previa ? previa.acreditacion_anterior_id : null),
            enviada_en: previa ? previa.enviada_en : ahora, estado_desde: ahora,
            nivel_estudios: d.nivel_estudios || null, carrera: d.carrera || null, carrera_tecnica: d.carrera_tecnica || null, estatus_estudios: d.estatus_estudios || null,
            anios_experiencia: d.anios_experiencia ? Number(d.anios_experiencia) : null,
            persona: { id: p.id, nombre: p.nombre, primer_apellido: p.primer_apellido, segundo_apellido: p.segundo_apellido || null, curp: p.curp,
              correo: p.correo, telefono: p.telefono, adscripcion: p.adscripcion, organizacion_id: p.organizacion_id || null,
              organizacion_nombre: p.organizacion_nombre || '', numero_expediente: p.numero_expediente || null }
          };
          const guarda = global_archivos() ? APD_ARCHIVOS_PRUEBA.guardaEnvio(registro, archivos).catch(() => {}) : Promise.resolve();
          guarda.then(() => ok({ folio, fecha: ahora }));
        }).catch(mal);
      }, modo === 'lento' ? 20000 : 400);
      signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
    });
  }
};
