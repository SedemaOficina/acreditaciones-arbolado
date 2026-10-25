/* =========================================================
   examen-servidor.js · Servidor SIMULADO del examen en línea (versión de prueba)

   En la versión de prueba no hay servidor: este archivo hace en el navegador
   lo que hará la API del módulo en el SIA (P29), con las mismas reglas, para
   probar las pantallas de punta a punta. Lo guardado vive en este navegador
   (localStorage «apd.examen.c.<código>»), así que la pantalla de quien aplica
   (aplicar.html) y la de la persona (examen.html) se ven entre pestañas.

   Reglas (decisiones 2026-10-17, P78):
     · Un código de un solo uso por persona y examen; lo genera quien aplica
       después de comprobar la identificación oficial. No se entra con la
       contraseña de la cuenta.
     · El orden de las preguntas y de sus opciones es distinto para cada
       persona y no cambia si vuelve a entrar. En la versión de prueba,
       todas son de opción múltiple con cuatro opciones de texto.
     · Cada respuesta se guarda al elegirla. Quien cambia de computadora
       sigue con el mismo código, con sus respuestas y el tiempo que le queda.
     · El tiempo corre desde «Empezar». Al agotarse, el examen se envía con
       lo contestado; después no se acepta ninguna respuesta.
     · La calificación la calcula el servidor: aciertos / preguntas × 10, con
       un decimal, sin redondear hacia arriba (P86). Queda en apd.examen con
       origen «examen_web» y no se modifica (resultado inapelable, R37).
     · Quien aplica puede suspender un examen, con motivo; un código perdido
       se repone y el anterior deja de servir.
     · El código se genera al pasar lista: quien aplica marca a la persona
       presente (asistencia del último día) después de compararla con su
       fotografía y su identificación oficial.
     · Un código abierto en una computadora no se abre en otra mientras la
       primera siga activa (cada pantalla avisa que sigue abierta cada pocos
       segundos). Si la computadora falla, deja de avisar y la persona sigue en
       otra a los pocos segundos. Cada intento se le cuenta a quien aplica.
     · Con el aviso de pantalla abierta, la computadora dice si puede leer en
       voz alta; si no puede, quien aplica lo ve en la fila de la persona
       (ajustes del equipo, 25/10/2026: lectura en voz alta).

   Falta de conexión (ajustes del equipo, 25/10/2026: no perder el avance del
   examen). En el SIA, una llamada a la API que no llega al servidor falla con
   motivo «conexion». Aquí se simula por pestaña con pruebas.conexion(false)
   (sessionStorage «apd.examen.prueba.sin_conexion», que sobrevive a la recarga):
   todo lo que pide la pantalla de la persona falla así hasta pruebas.conexion(true),
   que además avisa a la página con el evento «online».

   El reloj se detiene durante un corte (decisión de Liber del 25/10/2026). La
   pantalla de la persona manda una señal de vida con su código cada
   senal_cada_s segundos (senal()). El servidor cuenta el tiempo sólo mientras
   recibe señales: si pasan más de sin_senal_s segundos sin señal, deja de
   contar desde la última y reanuda al llegar la siguiente, que la pantalla
   manda después de enviar lo que quedó pendiente. Cada pausa queda en la
   bitácora del examen (los «eventos» del código: inicio, fin y duración). La pausa acumulada de una
   persona tiene un tope (tope_pausa_min): al pasarlo, el tiempo vuelve a
   correr y quien aplica decide (P214). Quien aplica ve «Sin conexión desde las
   HH:MM» y el tiempo que lleva detenido. El tiempo que muestra la pantalla sale
   siempre del servidor. En la prueba, el reloj del servidor se puede adelantar
   (pruebas.adelantar) y los parámetros se pueden cambiar (pruebas.parametros).
   El contrato para el servidor del SIA está en docs/EXAMEN-SEB.md, sección 5.

   EN EL SIA: la página nunca recibe la clave de respuestas. Aquí el banco
   ficticio (datos/examen-ficticio.js) viaja a la página sólo porque no hay
   servidor; preguntas() entrega las preguntas sin la clave, como la API.
   ========================================================= */
(function (global) {
  'use strict';
  /* Un registro por código (apd.examen.c.<código>): así dos pantallas que escriben a la vez no se pisan los demás
     códigos. La señal de pantalla abierta va aparte (apd.examen.latido.<código>), para no reescribir el examen.
     Son las mismas claves de APD_ARCHIVOS_PRUEBA.CLAVES (examen, latido, lista): ahí las lee la mezcla, que lleva la
     calificación a apd.examen, y ahí las borra «Borrar lo guardado». Aquí se repiten porque el servidor simulado se
     carga antes en examen.html. */
  const PREFIJO = 'apd.examen.c.';
  const LATIDO = 'apd.examen.latido.';
  const LISTA = 'apd.examen.lista';   // pase de lista del día del examen, por inscripción
  const VIVA_MS = 12000;              // una pantalla que no avisa en este tiempo se da por cerrada
  const RETARDO = 150; // simula la red
  const SIN_RED = 'apd.examen.prueba.sin_conexion'; // sólo la prueba: esta pestaña «sin conexión»
  const RELOJ = 'apd.examen.prueba.reloj';            // sólo la prueba: cuánto se adelantó el reloj del servidor (ms)
  const PARAMS = 'apd.examen.prueba.parametros';      // sólo la prueba: parámetros cambiados
  /* Parámetros del reloj durante un corte (decisión de Liber del 25/10/2026; en el SIA, de apd.parametro): cada cuántos
     segundos manda la pantalla su señal de vida, cuántos segundos sin señal detienen el tiempo y el tope de la pausa
     acumulada por persona, en minutos (P214) */
  const PARAMETROS = { senal_cada_s: 12, sin_senal_s: 30, tope_pausa_min: 30 };
  const BANCO = global.APD_EXAMEN_BANCO;

  const leeDe = (k) => { try { return JSON.parse(global.localStorage.getItem(k) || '{}'); } catch (e) { return {}; } };
  const escribeEn = (k, t) => { try { global.localStorage.setItem(k, JSON.stringify(t)); return true; } catch (e) { return false; } };
  const claves = (prefijo) => { try { return Object.keys(global.localStorage).filter((k) => k.startsWith(prefijo)); } catch (e) { return []; } };
  /* Todos los códigos, como tabla { código: registro }; recuerda cómo estaba cada uno para escribir sólo lo que cambió */
  function lee() {
    const t = {};
    const antes = {};
    for (const k of claves(PREFIJO)) {
      const crudo = global.localStorage.getItem(k);
      try {
        const reg = JSON.parse(crudo);
        // Un examen generado con un banco ficticio anterior (preguntas que ya no existen) se ignora
        if (!reg.preguntas.every((c) => reactivo(c))) continue;
        t[k.slice(PREFIJO.length)] = reg; antes[k.slice(PREFIJO.length)] = crudo;
      } catch (e) { /* registro dañado: se ignora */ }
    }
    Object.defineProperty(t, '_antes', { value: antes, enumerable: false });
    return t;
  }
  function escribe(t) {
    try {
      for (const [c, reg] of Object.entries(t)) {
        const s = JSON.stringify(reg);
        if (!t._antes || t._antes[c] !== s) global.localStorage.setItem(PREFIJO + c, s);
      }
      return true;
    } catch (e) { return false; }
  }
  const leeLatido = (c) => { try { return JSON.parse(global.localStorage.getItem(LATIDO + c) || 'null'); } catch (e) { return null; } };
  /* info: lo que la pantalla dice de sí misma; hoy, si puede leer en voz alta ({ voz: true | false | null }) */
  const ponLatido = (c, equipo, ms, info) => {
    try { global.localStorage.setItem(LATIDO + c, JSON.stringify({ equipo, t: ms, voz: info && typeof info.voz === 'boolean' ? info.voz : null })); } catch (e) { /* sin almacenamiento */ }
  };
  /* Falta de conexión simulada (sólo la prueba): la llamada no llega al servidor */
  const sinConexion = () => { try { return global.sessionStorage.getItem(SIN_RED) === '1'; } catch (e) { return false; } };
  const NO_LLEGA = 'No hay conexión con el servidor en este momento.';
  /* El reloj del servidor: el de la computadora, más lo que la prueba lo haya adelantado */
  const ahoraMs = () => { let d = 0; try { d = Number(global.localStorage.getItem(RELOJ)) || 0; } catch (e) { d = 0; } return Date.now() + d; };
  const ahora = () => new Date(ahoraMs()).toISOString();
  const iso = (ms) => new Date(ms).toISOString();
  const aMs = (x) => new Date(x).getTime();
  const parametros = () => {
    const p = Object.assign({}, PARAMETROS);
    for (const [k, v] of Object.entries(leeDe(PARAMS))) if (k in p && Number(v) > 0) p[k] = Number(v);
    return p;
  };
  const responde = (valor) => new Promise((ok) => setTimeout(() => ok(valor), RETARDO));
  const falla = (campo, mensaje, motivo) => new Promise((ok, mal) => setTimeout(() => mal({ campo, mensaje, motivo }), RETARDO));
  /* El navegador no guardó (almacenamiento bloqueado o lleno; auditoría «intentar romperlo», F4 A5 y M3): la API
     respondería un error y nada quedaría hecho. Nunca «Respuesta guardada.» ni un resultado que no quedó registrado. A la
     persona, de tú y con qué hacer; a quien aplica, de usted. */
  const NO_GUARDA = {
    respuesta: 'No se pudo guardar tu respuesta: levanta la mano. Quien aplica el examen te ayuda.',
    inicio: 'No se pudo empezar tu examen: levanta la mano. Quien aplica el examen te ayuda.',
    marca: 'No se pudo guardar la marca: levanta la mano. Quien aplica el examen te ayuda.',
    envio: 'No se pudo enviar tu examen: levanta la mano. Quien aplica el examen te ayuda; tus respuestas guardadas no se pierden.',
    lista: 'No se registró el pase de lista: este navegador no permitió guardarlo (puede estar en modo privado o con el almacenamiento bloqueado o lleno). Pruebe en una ventana normal o en otro navegador.',
    codigo: 'No se generó el código: este navegador no permitió guardarlo (puede estar en modo privado o con el almacenamiento bloqueado o lleno). Pruebe en una ventana normal o en otro navegador.',
    cambio: 'No se guardó el cambio: este navegador no permitió guardarlo (puede estar en modo privado o con el almacenamiento bloqueado o lleno). Pruebe en una ventana normal o en otro navegador.'
  };
  const noGuarda = (que) => falla(null, NO_GUARDA[que], 'almacenamiento');

  /* ----- Azar con semilla: el mismo código da siempre el mismo orden ----- */
  function semilla(texto) { let h = 2166136261; for (const c of texto) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function azar(s) { return () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function revuelve(lista, r) { const a = lista.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function nuevoCodigo(existentes) {
    const A = global.APD_CODIGO_EXAMEN.ALFABETO;
    for (;;) {
      const b = new Uint32Array(8);
      global.crypto.getRandomValues(b);
      const t = Array.from(b, (n) => A[n % A.length]).join('');
      const c = `${t.slice(0, 4)}-${t.slice(4)}`;
      if (!existentes[c]) return c;
    }
  }

  const reactivo = (clave) => BANCO.reactivos.find((r) => r.clave === clave);

  /* Elige las preguntas de un examen: el banco barajado, hasta las que lleva el examen */
  const elige = (cuantas, r) => revuelve(BANCO.reactivos.map((x) => x.clave), r).slice(0, cuantas);
  /* Opciones: al azar */
  const ordenDe = (k, r) => revuelve(Object.keys(reactivo(k).opciones), r);
  const limiteMs = (reg) => reg.minutos * 60000;
  const topeMs = () => parametros().tope_pausa_min * 60000;
  /* La pausa abierta (decisión de Liber del 25/10/2026): un examen en curso sin señal de su pantalla desde hace más de
     sin_senal_s segundos está detenido desde la última señal. null si no lo está. */
  function pausaAbierta(reg, t = ahoraMs()) {
    if (!reg.iniciado_en || reg.terminado_en || reg.suspendido || reg.reemplazado_por) return null;
    const desde = aMs(reg.senal_en || reg.iniciado_en);
    return t - desde > parametros().sin_senal_s * 1000 ? { desde, ms: t - desde } : null;
  }
  /* El tiempo detenido que cuenta: las pausas cerradas más la abierta, hasta el tope por persona */
  function detenidoMs(reg, t = ahoraMs()) {
    const p = pausaAbierta(reg, t);
    return Math.min(topeMs(), (reg.pausa_ms || 0) + (p ? p.ms : 0));
  }
  function restanteMs(reg, t = ahoraMs()) {
    if (!reg.iniciado_en) return limiteMs(reg);
    return Math.max(0, aMs(reg.iniciado_en) + limiteMs(reg) + detenidoMs(reg, t) - t);
  }
  /* Cierra la pausa abierta (al llegar una señal o al cerrarse el examen) y la anota en la bitácora del examen: inicio, fin,
     duración, cuánto de ella detuvo el tiempo y, si pasó el tope, cuándo */
  function cierraPausa(reg, t, como) {
    const p = pausaAbierta(reg, t);
    if (!p) return null;
    const antes = Math.min(topeMs(), reg.pausa_ms || 0);
    reg.pausa_ms = (reg.pausa_ms || 0) + p.ms;
    const detuvo = Math.min(topeMs(), reg.pausa_ms) - antes;
    const nota = { evento: 'pausa', inicio: iso(p.desde), fin: iso(t), duracion_ms: p.ms, detenido_ms: detuvo, termino: como };
    if (detuvo < p.ms) nota.tope_en = iso(p.desde + detuvo);
    reg.eventos = (reg.eventos || []).concat([nota]);
    return nota;
  }
  /* Lo que se sabe del tiempo detenido: la pausa abierta (desde cuándo y cuánto lleva), el total y si pasó el tope */
  function pausaDe(reg, t = ahoraMs()) {
    const p = pausaAbierta(reg, t);
    const total = detenidoMs(reg, t);
    return {
      abierta: p ? { desde: iso(p.desde), ms: p.ms } : null,
      detenido_ms: total, tope: total >= topeMs(),
      pausas: (reg.eventos || []).filter((b) => b.evento === 'pausa').length
    };
  }
  /* Situación de un código: sin_empezar, contestando, terminado, suspendido, reemplazado */
  function situacion(reg) {
    if (reg.reemplazado_por) return 'reemplazado';
    if (reg.suspendido) return 'suspendido';
    if (reg.terminado_en) return 'terminado';
    return reg.iniciado_en ? 'contestando' : 'sin_empezar';
  }

  /* Califica y cierra (lo hace sólo el servidor) */
  function cierra(reg, motivo) {
    const aciertos = reg.preguntas.filter((k) => reg.respuestas[k] && reg.respuestas[k] === reactivo(k).correcta).length;
    reg.aciertos = aciertos;
    reg.calificacion = Math.floor((aciertos / reg.preguntas.length) * 100) / 10; // un decimal, sin redondear hacia arriba (P86)
    reg.aprobado = reg.calificacion >= reg.minima;
    // Al agotarse el tiempo, la hora de cierre es la del límite (con el tiempo detenido), aunque se detecte después
    const t = ahoraMs();
    const fin = motivo === 'tiempo' ? Math.min(t, aMs(reg.iniciado_en) + limiteMs(reg) + detenidoMs(reg, t)) : t;
    // Una pausa abierta (después del tope) se cierra en la bitácora con el examen
    cierraPausa(reg, fin, motivo);
    reg.terminado_en = iso(fin);
    reg.motivo_fin = motivo;
    return reg;
  }
  /* Si el tiempo ya se agotó, el examen se cierra con lo contestado. Si el navegador no guarda el cierre, sigue como
     estaba (sin tiempo, sin aceptar respuestas): no se informa un resultado que no quedó registrado (F4 A5) */
  function alDia(t, codigo) {
    const reg = t[codigo];
    if (reg && reg.iniciado_en && !reg.terminado_en && !reg.suspendido && !reg.reemplazado_por && restanteMs(reg) === 0) {
      t[codigo] = cierra(JSON.parse(JSON.stringify(reg)), 'tiempo');
      if (!escribe(t)) t[codigo] = reg;
    }
    return t[codigo];
  }

  /* Lo que ve la persona: sin la clave de respuestas */
  function vista(reg) {
    const preguntas = reg.preguntas.map((k) => {
      const r = reactivo(k);
      return { clave: k, texto: r.texto, opciones: reg.orden_opciones[k].map((letra) => ({ valor: letra, texto: r.opciones[letra] })) };
    });
    const v = {
      codigo: reg.codigo, situacion: situacion(reg), persona: reg.persona, examen: reg.examen, grupo: reg.grupo,
      minutos: reg.minutos, minima: reg.minima, iniciado_en: reg.iniciado_en, restante_ms: restanteMs(reg),
      // Cada cuánto manda la pantalla su señal de vida y el tiempo detenido por falta de conexión (decisión del 25/10/2026)
      senal_cada_ms: parametros().senal_cada_s * 1000, pausa: pausaDe(reg),
      respuestas: Object.assign({}, reg.respuestas), marcadas: reg.marcadas.slice(), preguntas,
      // El código al que repone: lo que quedó pendiente en esta computadora con el anterior se envía con éste
      repone_a: reg.repone_a || null
    };
    if (reg.terminado_en) Object.assign(v, { calificacion: reg.calificacion, aprobado: reg.aprobado, aciertos: reg.aciertos, total: reg.preguntas.length, motivo_fin: reg.motivo_fin, terminado_en: reg.terminado_en });
    if (reg.suspendido) v.suspendido = { motivo: reg.suspendido.motivo };
    return v;
  }

  const API = {
    /* ----- Quien aplica el examen ----- */
    /* Códigos de un grupo (todos, también los reemplazados), con su avance */
    delGrupo(grupoId) {
      const t = lee();
      for (const c of Object.keys(t)) alDia(t, c);
      return Object.values(t).filter((r) => r.grupo.id === grupoId).map((r) => {
        // Si la pantalla abierta con este código no puede leer en voz alta (mientras siga abierta)
        const l = leeLatido(r.codigo);
        return Object.assign({}, r, {
          situacion: situacion(r), restante_ms: restanteMs(r),
          // Sin conexión desde la última señal y el tiempo detenido (decisión de Liber del 25/10/2026)
          pausa: pausaDe(r), eventos: (r.eventos || []).slice(),
          contestadas: Object.keys(r.respuestas).length, total: r.preguntas.length,
          voz: l && l.voz === false && Date.now() - l.t < VIVA_MS ? false : null
        });
      });
    },
    /* Genera el código de una persona inscrita (si ya tiene uno vigente, devuelve ése) */
    generar({ inscripcion_id, folio, persona, grupo, tipo, modalidad, minima, por }) {
      const t = lee();
      const vigente = Object.values(t).find((r) => r.inscripcion_id === inscripcion_id && !r.reemplazado_por);
      if (vigente) return responde(vigente);
      const ex = BANCO.examenDe(tipo, modalidad);
      const codigo = nuevoCodigo(t);
      const r = azar(semilla(codigo));
      const preguntas = elige(ex.preguntas, r);
      const orden_opciones = Object.fromEntries(preguntas.map((k) => [k, ordenDe(k, r)]));
      t[codigo] = {
        codigo, inscripcion_id, folio, persona, grupo, examen: { tipo, modalidad },
        minutos: ex.minutos, minima, preguntas, orden_opciones,
        generado_en: ahora(), generado_por: por, iniciado_en: null, respuestas: {}, marcadas: [], salidas: 0,
        otro_equipo: 0, senal_en: null, pausa_ms: 0, eventos: [],
        terminado_en: null, suspendido: null, reemplazado_por: null
      };
      if (!escribe(t)) return noGuarda('codigo');
      return responde(t[codigo]);
    },
    /* Repone un código perdido: el examen sigue igual (mismas preguntas, respuestas y tiempo) con otro código */
    reponer(codigo, por) {
      const t = lee();
      const reg = alDia(t, codigo);
      if (!reg || reg.reemplazado_por) return falla(null, 'Ese código ya no está vigente.');
      if (reg.terminado_en) return falla(null, 'Ese examen ya se envió: no hace falta otro código.');
      const nuevo = nuevoCodigo(t);
      t[nuevo] = Object.assign({}, reg, { codigo: nuevo, generado_en: ahora(), generado_por: por, repone_a: codigo, otro_equipo: 0 });
      reg.reemplazado_por = nuevo;
      if (!escribe(t)) return noGuarda('codigo');
      return responde(t[nuevo]);
    },
    /* Pase de lista del día del examen: { inscripcion_id: { presente, en, por } } */
    lista() { return leeDe(LISTA); },
    pasarLista(inscripcion_id, presente, por) {
      const l = leeDe(LISTA);
      l[inscripcion_id] = { presente: Boolean(presente), en: ahora(), por };
      if (!escribeEn(LISTA, l)) return noGuarda('lista');
      return responde(l[inscripcion_id]);
    },
    suspender(codigo, motivo, por) {
      const t = lee();
      const reg = alDia(t, codigo);
      if (!reg || reg.reemplazado_por) return falla(null, 'Ese código ya no está vigente.');
      if (reg.terminado_en) return falla(null, 'Ese examen ya se envió y ya está calificado: no se puede suspender.');
      cierraPausa(reg, ahoraMs(), 'suspendido');
      reg.suspendido = { motivo: String(motivo || '').trim(), en: ahora(), por };
      if (!escribe(t)) return noGuarda('cambio');
      return responde(reg);
    },

    /* ----- La persona ----- */
    /* equipo: identificador de la pantalla (cada pestaña del navegador tiene el suyo); info: lo que dice de sí misma */
    entrar(codigoEscrito, equipo, info) {
      if (sinConexion()) return falla(null, `${NO_LLEGA} Espera un momento y vuelve a intentarlo; si no se arregla, levanta la mano.`, 'conexion');
      // Sin banco de preguntas (no cargó, vino dañado o vacío), ningún código se puede abrir: no es culpa del código y no
      // se dice que no existe (auditoría 2026-10-19, B5-03). En el SIA, un error del servidor tampoco parece error de código.
      if (!BANCO || !Array.isArray(BANCO.reactivos) || !BANCO.reactivos.length) return falla(null, 'No se pudo abrir el examen. Avisa a quien aplica el examen.', 'sin_banco');
      const codigo = global.APD_FORMATOS['codigo-examen'].normaliza(codigoEscrito);
      const t = lee();
      const reg = alDia(t, codigo);
      if (!reg) return falla('codigo', 'Ese código no existe. Revisa que lo escribiste igual que en tu papel.', 'no_existe');
      if (reg.reemplazado_por) return falla('codigo', 'Ese código ya no sirve porque se te dio otro. Usa el código nuevo o pide ayuda a quien aplica el examen.', 'reemplazado');
      // Un examen enviado sólo se vuelve a ver en la pantalla en que se presentó; en otra computadora el código ya no
      // muestra el nombre ni la calificación a quien tenga el papel (código de un solo uso; auditoría «intentar romperlo»,
      // F3 B11). La persona ve su calificación en «Mis trámites».
      if (situacion(reg) === 'terminado') {
        const l = leeLatido(codigo);
        if (!equipo || !l || l.equipo !== equipo) return falla('codigo', 'Este examen ya se envió: el código ya no sirve. Tu calificación la ves en «Mis trámites».', 'terminado');
      }
      if (['sin_empezar', 'contestando'].includes(situacion(reg)) && equipo) {
        const l = leeLatido(codigo);
        if (l && l.equipo !== equipo && Date.now() - l.t < VIVA_MS) {
          reg.otro_equipo = (reg.otro_equipo || 0) + 1;
          escribe(t);
          return falla('codigo', 'Este código está abierto en otra computadora. Levanta la mano: quien aplica el examen te ayuda.', 'otro_equipo');
        }
        ponLatido(codigo, equipo, Date.now(), info);
      }
      return responde(vista(reg));
    },
    /* La pantalla avisa que sigue abierta. Si otra computadora tomó el examen, se lo dice. Sin conexión, el aviso no llega. */
    latido(codigo, equipo, info) {
      if (!equipo || sinConexion()) return { ok: false };
      const l = leeLatido(codigo);
      if (l && l.equipo !== equipo) return { otro: true };
      ponLatido(codigo, equipo, Date.now(), info);
      return { ok: true };
    },
    /* Señal de vida de la pantalla con su código (decisión de Liber del 25/10/2026): el servidor cuenta el tiempo sólo
       mientras llegan. Si había una pausa abierta (más de sin_senal_s segundos sin señal), se cierra, queda en la bitácora
       del examen y el tiempo se reanuda. La pantalla la manda cada senal_cada_s segundos y, al volver la conexión, después
       de enviar lo que quedó pendiente. Responde lo que ve la persona, con el tiempo que le queda. */
    senal(codigo) {
      if (sinConexion()) return falla(null, NO_LLEGA, 'conexion');
      const t = lee();
      const reg = alDia(t, codigo);
      if (!reg) return falla(null, 'Ese código no existe.', 'no_existe');
      if (situacion(reg) === 'contestando') {
        const ms = ahoraMs();
        cierraPausa(reg, ms, 'senal');
        reg.senal_en = iso(ms);
        if (!escribe(t)) return noGuarda('cambio');
      }
      return responde(vista(reg));
    },
    /* Al terminar o salir, la pantalla suelta el código */
    suelta(codigo, equipo) {
      const l = leeLatido(codigo);
      if (l && l.equipo === equipo) ponLatido(codigo, equipo, 0);
    },
    iniciar(codigo) {
      if (sinConexion()) return falla(null, `${NO_LLEGA} Espera un momento y presiona otra vez «Empezar el examen».`, 'conexion');
      const t = lee();
      const reg = alDia(t, codigo);
      if (!reg || situacion(reg) !== 'sin_empezar') return responde(reg ? vista(reg) : null);
      reg.iniciado_en = ahora();
      reg.senal_en = reg.iniciado_en;
      if (!escribe(t)) return noGuarda('inicio');
      return responde(vista(reg));
    },
    /* Guarda una respuesta. Se rechaza si el examen ya se cerró, se suspendió o se acabó el tiempo. */
    responder(codigo, clave, valor) {
      if (sinConexion()) return falla(null, NO_LLEGA, 'conexion');
      const t = lee();
      const reg = alDia(t, codigo);
      if (!reg || situacion(reg) !== 'contestando') return falla(null, 'Tu examen ya no acepta respuestas.', reg ? situacion(reg) : 'no_existe');
      if (restanteMs(reg) === 0) return falla(null, 'Se acabó el tiempo: tu examen ya no acepta respuestas.', 'tiempo');
      if (!reg.preguntas.includes(clave) || !reg.orden_opciones[clave].includes(valor)) return falla(null, 'Esa respuesta no corresponde a tu examen.');
      reg.respuestas[clave] = valor;
      if (!escribe(t)) return noGuarda('respuesta');
      return responde({ guardada: true, restante_ms: restanteMs(reg) });
    },
    marcar(codigo, clave, si) {
      if (sinConexion()) return falla(null, NO_LLEGA, 'conexion');
      const t = lee();
      const reg = alDia(t, codigo);
      if (!reg || situacion(reg) !== 'contestando') return responde(null);
      reg.marcadas = reg.marcadas.filter((k) => k !== clave).concat(si ? [clave] : []);
      if (!escribe(t)) return noGuarda('marca');
      return responde({ ok: true });
    },
    /* La persona salió de la ventana del examen (otra pestaña o programa): se le cuenta a quien aplica */
    salida(codigo) {
      if (sinConexion()) return falla(null, NO_LLEGA, 'conexion');
      const t = lee();
      const reg = t[codigo];
      if (reg && situacion(reg) === 'contestando') { reg.salidas += 1; escribe(t); }
      return responde({ ok: true });
    },
    /* Califica y cierra. Si no quedó registrado, no hay resultado (F4 A5: «No aprobaste · 0.0 · Tu calificación quedó
       registrada» sin nada guardado); también al agotarse el tiempo */
    terminar(codigo, motivo) {
      if (sinConexion()) return falla(null, `${NO_LLEGA} Tu examen todavía no se envía; tus respuestas no se pierden.`, 'conexion');
      const t = lee();
      const reg = t[codigo];
      if (!reg) return falla(null, 'Ese código no existe.');
      if (situacion(reg) === 'contestando') {
        // «Se acabó el tiempo» lo decide el servidor: si a la pantalla se le acabó pero el servidor tuvo el tiempo detenido
        // (decisión del 25/10/2026), el examen sigue y la pantalla toma el tiempo que queda
        if (motivo === 'tiempo' && restanteMs(reg) > 0) return responde(vista(reg));
        cierra(reg, motivo === 'tiempo' || restanteMs(reg) === 0 ? 'tiempo' : 'enviado');
        if (!escribe(t)) return noGuarda('envio');
      }
      return responde(vista(reg));
    },
    /* Sin conexión no hay respuesta (null): la pantalla sigue con lo que tiene */
    estado(codigo) {
      if (sinConexion()) return null;
      const t = lee();
      const reg = alDia(t, codigo);
      return reg ? vista(reg) : null;
    },

    /* ----- Sólo para el menú de pruebas ----- */
    pruebas: {
      /* Deja n minutos en el reloj de un examen que ya empezó */
      dejarMinutos(codigo, n) {
        const t = lee();
        const reg = t[codigo];
        if (!reg || situacion(reg) !== 'contestando') return false;
        const ms = ahoraMs();
        reg.iniciado_en = iso(ms - limiteMs(reg) - detenidoMs(reg, ms) + n * 60000);
        reg.senal_en = iso(ms);
        return escribe(t);
      },
      /* Contesta: «bien» todas correctas, «azar» al azar, «reprobar» una de cada tres correcta */
      contestar(codigo, modo) {
        const t = lee();
        const reg = t[codigo];
        if (!reg || situacion(reg) !== 'contestando') return false;
        reg.preguntas.forEach((k, i) => {
          const correcta = reactivo(k).correcta;
          const otras = reg.orden_opciones[k].filter((l) => l !== correcta);
          reg.respuestas[k] = modo === 'bien' ? correcta : modo === 'reprobar' ? (i % 3 === 0 ? correcta : otras[0]) : reg.orden_opciones[k][Math.floor(Math.random() * reg.orden_opciones[k].length)];
        });
        return escribe(t);
      },
      iniciar(codigo) { const t = lee(); const reg = t[codigo]; if (reg && !reg.iniciado_en) { reg.iniciado_en = ahora(); reg.senal_en = reg.iniciado_en; escribe(t); } },
      /* Adelanta el reloj del servidor ms milisegundos (decisión del 25/10/2026: probar la pausa sin esperar). Con
         conSenal (un código), como si su pantalla hubiera mandado su señal todo ese tiempo */
      adelantar(ms, conSenal) {
        try { global.localStorage.setItem(RELOJ, String((Number(global.localStorage.getItem(RELOJ)) || 0) + ms)); } catch (e) { return false; }
        if (conSenal) {
          const t = lee();
          const reg = t[conSenal];
          if (reg && situacion(reg) === 'contestando') { reg.senal_en = ahora(); escribe(t); }
        }
        return true;
      },
      /* Cambia los parámetros del reloj (senal_cada_s, sin_senal_s, tope_pausa_min); sin argumento, los de siempre */
      parametros(p) { return p ? escribeEn(PARAMS, Object.assign(leeDe(PARAMS), p)) : (() => { try { global.localStorage.removeItem(PARAMS); return true; } catch (e) { return false; } })(); },
      /* Simula que esta pestaña pierde (false) o recupera (true) la conexión; al recuperarla avisa con «online», como el
         navegador. Sólo la pantalla de la persona: la de quien aplica sigue viendo el servidor. */
      conexion(hay) {
        try { if (hay) global.sessionStorage.removeItem(SIN_RED); else global.sessionStorage.setItem(SIN_RED, '1'); } catch (e) { return false; }
        global.dispatchEvent(new Event(hay ? 'online' : 'offline'));
        return true;
      },
      sinConexion
    }
  };
  API.PREFIJO = PREFIJO;
  API.parametros = parametros;
  API.ahora = ahora;
  API.LISTA = LISTA;
  global.APD_EXAMEN_API = API;
}(window));
