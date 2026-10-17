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
       persona y no cambia si vuelve a entrar.
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

   EN EL SIA: la página nunca recibe la clave de respuestas. Aquí el banco
   ficticio (datos/examen-ficticio.js) viaja a la página sólo porque no hay
   servidor; preguntas() entrega las preguntas sin la clave, como la API.
   ========================================================= */
(function (global) {
  'use strict';
  /* Un registro por código (apd.examen.c.<código>): así dos pantallas que escriben a la vez no se pisan los demás
     códigos. La señal de pantalla abierta va aparte (apd.examen.latido.<código>), para no reescribir el examen. */
  const PREFIJO = 'apd.examen.c.';
  const LATIDO = 'apd.examen.latido.';
  const LISTA = 'apd.examen.lista';   // pase de lista del día del examen, por inscripción
  const VIVA_MS = 12000;              // una pantalla que no avisa en este tiempo se da por cerrada
  const RETARDO = 150; // simula la red
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
      try { t[k.slice(PREFIJO.length)] = JSON.parse(crudo); antes[k.slice(PREFIJO.length)] = crudo; } catch (e) { /* registro dañado: se ignora */ }
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
  const ponLatido = (c, equipo, ms) => { try { global.localStorage.setItem(LATIDO + c, JSON.stringify({ equipo, t: ms })); } catch (e) { /* sin almacenamiento */ } };
  const ahora = () => new Date().toISOString();
  const responde = (valor) => new Promise((ok) => setTimeout(() => ok(valor), RETARDO));
  const falla = (campo, mensaje, motivo) => new Promise((ok, mal) => setTimeout(() => mal({ campo, mensaje, motivo }), RETARDO));

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
  const limiteMs = (reg) => reg.minutos * 60000;
  function restanteMs(reg) {
    if (!reg.iniciado_en) return limiteMs(reg);
    return Math.max(0, new Date(reg.iniciado_en).getTime() + limiteMs(reg) - Date.now());
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
    // Al agotarse el tiempo, la hora de cierre es la del límite, aunque se detecte después
    reg.terminado_en = motivo === 'tiempo' ? new Date(new Date(reg.iniciado_en).getTime() + limiteMs(reg)).toISOString() : ahora();
    reg.motivo_fin = motivo;
    return reg;
  }
  /* Si el tiempo ya se agotó, el examen se cierra con lo contestado */
  function alDia(t, codigo) {
    const reg = t[codigo];
    if (reg && reg.iniciado_en && !reg.terminado_en && !reg.suspendido && !reg.reemplazado_por && restanteMs(reg) === 0) { cierra(reg, 'tiempo'); escribe(t); }
    return reg;
  }

  /* Lo que ve la persona: sin la clave de respuestas */
  function vista(reg) {
    const preguntas = reg.preguntas.map((k) => {
      const r = reactivo(k);
      return {
        clave: k, texto: r.texto,
        opciones: reg.orden_opciones[k].map((letra) => {
          const o = r.opciones[letra];
          return typeof o === 'string' ? { valor: letra, texto: o } : { valor: letra, texto: o.texto, imagen: o.imagen };
        })
      };
    });
    const v = {
      codigo: reg.codigo, situacion: situacion(reg), persona: reg.persona, examen: reg.examen, grupo: reg.grupo,
      minutos: reg.minutos, minima: reg.minima, iniciado_en: reg.iniciado_en, restante_ms: restanteMs(reg),
      respuestas: Object.assign({}, reg.respuestas), marcadas: reg.marcadas.slice(), preguntas
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
      return Object.values(t).filter((r) => r.grupo.id === grupoId).map((r) => Object.assign({}, r, {
        situacion: situacion(r), restante_ms: restanteMs(r),
        contestadas: Object.keys(r.respuestas).length, total: r.preguntas.length
      }));
    },
    /* Genera el código de una persona inscrita (si ya tiene uno vigente, devuelve ése) */
    generar({ inscripcion_id, folio, persona, grupo, tipo, modalidad, minima, por }) {
      const t = lee();
      const vigente = Object.values(t).find((r) => r.inscripcion_id === inscripcion_id && !r.reemplazado_por);
      if (vigente) return responde(vigente);
      const ex = BANCO.examenDe(tipo, modalidad);
      const codigo = nuevoCodigo(t);
      const r = azar(semilla(codigo));
      const preguntas = revuelve(BANCO.reactivos.map((x) => x.clave), r).slice(0, ex.preguntas);
      const orden_opciones = Object.fromEntries(preguntas.map((k) => [k, revuelve(Object.keys(reactivo(k).opciones), r)]));
      t[codigo] = {
        codigo, inscripcion_id, folio, persona, grupo, examen: { tipo, modalidad },
        minutos: ex.minutos, minima, preguntas, orden_opciones,
        generado_en: ahora(), generado_por: por, iniciado_en: null, respuestas: {}, marcadas: [], salidas: 0,
        otro_equipo: 0,
        terminado_en: null, suspendido: null, reemplazado_por: null
      };
      escribe(t);
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
      escribe(t);
      return responde(t[nuevo]);
    },
    /* Pase de lista del día del examen: { inscripcion_id: { presente, en, por } } */
    lista() { return leeDe(LISTA); },
    pasarLista(inscripcion_id, presente, por) {
      const l = leeDe(LISTA);
      l[inscripcion_id] = { presente: Boolean(presente), en: ahora(), por };
      escribeEn(LISTA, l);
      return responde(l[inscripcion_id]);
    },
    suspender(codigo, motivo, por) {
      const t = lee();
      const reg = alDia(t, codigo);
      if (!reg || reg.reemplazado_por) return falla(null, 'Ese código ya no está vigente.');
      if (reg.terminado_en) return falla(null, 'Ese examen ya se envió y ya está calificado: no se puede suspender.');
      reg.suspendido = { motivo: String(motivo || '').trim(), en: ahora(), por };
      escribe(t);
      return responde(reg);
    },

    /* ----- La persona ----- */
    /* equipo: identificador de la pantalla (cada pestaña del navegador tiene el suyo) */
    entrar(codigoEscrito, equipo) {
      const codigo = global.APD_FORMATOS['codigo-examen'].normaliza(codigoEscrito);
      const t = lee();
      const reg = alDia(t, codigo);
      if (!reg) return falla('codigo', 'Ese código no existe. Revisa que lo escribiste igual que en tu papel.', 'no_existe');
      if (reg.reemplazado_por) return falla('codigo', 'Ese código ya no sirve porque se te dio otro. Usa el código nuevo o pide ayuda a quien aplica el examen.', 'reemplazado');
      if (['sin_empezar', 'contestando'].includes(situacion(reg)) && equipo) {
        const l = leeLatido(codigo);
        if (l && l.equipo !== equipo && Date.now() - l.t < VIVA_MS) {
          reg.otro_equipo = (reg.otro_equipo || 0) + 1;
          escribe(t);
          return falla('codigo', 'Este código está abierto en otra computadora. Levanta la mano: quien aplica el examen te ayuda.', 'otro_equipo');
        }
        ponLatido(codigo, equipo, Date.now());
      }
      return responde(vista(reg));
    },
    /* La pantalla avisa que sigue abierta. Si otra computadora tomó el examen, se lo dice. */
    latido(codigo, equipo) {
      if (!equipo) return { ok: false };
      const l = leeLatido(codigo);
      if (l && l.equipo !== equipo) return { otro: true };
      ponLatido(codigo, equipo, Date.now());
      return { ok: true };
    },
    /* Al terminar o salir, la pantalla suelta el código */
    suelta(codigo, equipo) {
      const l = leeLatido(codigo);
      if (l && l.equipo === equipo) ponLatido(codigo, equipo, 0);
    },
    iniciar(codigo) {
      const t = lee();
      const reg = alDia(t, codigo);
      if (!reg || situacion(reg) !== 'sin_empezar') return responde(reg ? vista(reg) : null);
      reg.iniciado_en = ahora();
      escribe(t);
      return responde(vista(reg));
    },
    /* Guarda una respuesta. Se rechaza si el examen ya se cerró, se suspendió o se acabó el tiempo. */
    responder(codigo, clave, valor) {
      const t = lee();
      const reg = alDia(t, codigo);
      if (!reg || situacion(reg) !== 'contestando') return falla(null, 'Tu examen ya no acepta respuestas.', reg ? situacion(reg) : 'no_existe');
      if (!reg.preguntas.includes(clave) || !reg.orden_opciones[clave].includes(valor)) return falla(null, 'Esa respuesta no corresponde a tu examen.');
      reg.respuestas[clave] = valor;
      escribe(t);
      return responde({ guardada: true, restante_ms: restanteMs(reg) });
    },
    marcar(codigo, clave, si) {
      const t = lee();
      const reg = alDia(t, codigo);
      if (!reg || situacion(reg) !== 'contestando') return responde(null);
      reg.marcadas = reg.marcadas.filter((k) => k !== clave).concat(si ? [clave] : []);
      escribe(t);
      return responde({ ok: true });
    },
    /* La persona salió de la ventana del examen (otra pestaña o programa): se le cuenta a quien aplica */
    salida(codigo) {
      const t = lee();
      const reg = t[codigo];
      if (reg && situacion(reg) === 'contestando') { reg.salidas += 1; escribe(t); }
      return responde({ ok: true });
    },
    terminar(codigo, motivo) {
      const t = lee();
      const reg = alDia(t, codigo);
      if (!reg) return falla(null, 'Ese código no existe.');
      if (situacion(reg) === 'contestando') { cierra(reg, motivo === 'tiempo' ? 'tiempo' : 'enviado'); escribe(t); }
      return responde(vista(reg));
    },
    estado(codigo) {
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
        reg.iniciado_en = new Date(Date.now() - limiteMs(reg) + n * 60000).toISOString();
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
          reg.respuestas[k] = modo === 'bien' ? correcta : modo === 'reprobar' ? (i % 3 === 0 ? correcta : otras[0]) : reg.orden_opciones[k][Math.floor(Math.random() * 4)];
        });
        return escribe(t);
      },
      iniciar(codigo) { const t = lee(); const reg = t[codigo]; if (reg && !reg.iniciado_en) { reg.iniciado_en = ahora(); escribe(t); } },
      cuantos() { return claves(PREFIJO).length; },
      borra() { try { for (const k of claves(PREFIJO).concat(claves(LATIDO))) global.localStorage.removeItem(k); global.localStorage.removeItem(LISTA); } catch (e) { /* sin almacenamiento */ } }
    }
  };
  API.PREFIJO = PREFIJO;
  API.LISTA = LISTA;
  API.situacion = situacion;
  global.APD_EXAMEN_API = API;
}(window));
