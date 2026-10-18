/* =========================================================
   formkit.core.js · Estándar de formularios del SIA (SEDEMA) · v1.4.1

   Núcleo obligatorio. Lee la declaración de cada campo de sus ATRIBUTOS
   (required, data-formato, data-si, data-cruzada, data-uso…) y toma
   patrones, límites y mensajes de validaciones.config.js. Decisión C1:
   la superficie para quien programa es el HTML; la fuente de verdad de la
   validación es un solo archivo de configuración.

   Qué hace el núcleo: anuncios para lector de pantalla, preparación de cada
   campo (marca de obligatorio, ayuda, error, contador), visibilidad
   condicional, validación individual y cruzada con el momento acordado
   (decisión C5), resumen de errores con foco, borrador local, envío sin
   duplicados y registro de módulos. Todo lo demás es un módulo opcional
   (codigo/modulos/*) que se carga sólo si el formulario lo usa.

   Sin dependencias, sin manejadores en línea (eventos por delegación), sin
   valores fijos (todo viene de la configuración). Script clásico para que
   abra desde un archivo local.

   Orden del archivo: utilidades → configuración → instancia (campos,
   validación, resumen, condicionales, borrador, envío) → registro de
   módulos → arranque.
   ========================================================= */
(function (global) {
  'use strict';

  const BASE = global.FORMKIT_VALIDACIONES;
  if (!BASE) throw new Error('FormKit: falta validaciones.config.js; debe cargarse antes que formkit.core.js');

  /* ---------- Utilidades ---------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const plantilla = BASE.plantilla;
  const BYTES_POR_MB = 1048576;
  const BYTES_POR_KB = 1024;
  const MS_POR_DIA = 86400000;
  const pesoTxt = (b) => (b < BYTES_POR_MB ? `${Math.max(1, Math.round(b / BYTES_POR_KB))} KB` : `${(b / BYTES_POR_MB).toFixed(1)} MB`);
  const normalizaBusqueda = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  let contadorIds = 0;
  const idUnico = (p) => `${p}-${++contadorIds}`;

  /* Fusión profunda de la configuración base con los ajustes del formulario
     (window.FORMKIT_CONFIG): el formulario sólo escribe lo que cambia. */
  function fusiona(base, extra) {
    if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return extra === undefined ? base : extra;
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const k of Object.keys(extra)) out[k] = fusiona(base ? base[k] : undefined, extra[k]);
    return out;
  }

  /* localStorage puede no existir o lanzar (ventana privada). El formulario
     funciona sin él: sólo pierde el borrador y las sugerencias. */
  const memoria = new Map();
  const almacen = {
    lee(k) { try { return global.localStorage.getItem(k); } catch (e) { return memoria.has(k) ? memoria.get(k) : null; } },
    escribe(k, v) { try { global.localStorage.setItem(k, v); return true; } catch (e) { memoria.set(k, v); return false; } },
    borra(k) { try { global.localStorage.removeItem(k); } catch (e) { /* sin almacén */ } memoria.delete(k); }
  };

  /* Icono del sprite: <svg class="icono"><use href="#i-nombre"></use></svg> */
  function icono(nombre, clase = 'icono') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', clase);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#i-${nombre}`);
    svg.appendChild(use);
    return svg;
  }

  /* El sprite se inyecta una vez por página desde iconos.js (generado de
     codigo/iconos/sprite.svg). Si no se cargó, los iconos quedan vacíos y el
     texto que siempre los acompaña sigue diciendo lo mismo. */
  function inyectaSprite() {
    if (!global.FORMKIT_ICONOS || $('[data-sprite-iconos]')) return;
    const cont = document.createElement('div');
    cont.setAttribute('data-sprite-iconos', '');
    cont.hidden = true;
    cont.innerHTML = global.FORMKIT_ICONOS;
    document.body.prepend(cont);
  }

  /* ---------- Anuncios para lector de pantalla ----------
     Todo anuncio también se ve (FRM-40): lo que sólo oye el lector no existe
     para quien ve la pantalla. anuncia(texto, { visible: elemento }) escribe
     el texto también en ese elemento y lo muestra; sin él, lo anunciado ya
     debe estar en pantalla. El segundo argumento también puede ser true
     (asertivo), como antes. */
  let regionAnuncios = null;
  let temporizadorAnuncio = 0;
  function anuncia(texto, opciones = false) {
    const { cortes = false, visible = null } = opciones && typeof opciones === 'object' ? opciones : { cortes: opciones };
    if (visible) { ($('.aviso-texto', visible) || visible).textContent = texto; visible.hidden = false; }
    if (!regionAnuncios) {
      regionAnuncios = $('[data-anuncios]') || document.createElement('div');
      regionAnuncios.className = 'solo-lector';
      regionAnuncios.setAttribute('data-anuncios', '');
      if (!regionAnuncios.parentNode) document.body.appendChild(regionAnuncios);
    }
    regionAnuncios.setAttribute('aria-live', cortes ? 'assertive' : 'polite');
    clearTimeout(temporizadorAnuncio);
    regionAnuncios.textContent = '';
    temporizadorAnuncio = setTimeout(() => { regionAnuncios.textContent = texto; }, FormKit.config.anuncios.retardoMs);
  }

  /* ---------- Avisos (FRM-39) ----------
     FormKit.aviso(lugar, { tono, titulo, texto, foco }) pinta un aviso con el
     icono y el rol de su tono, su título y su texto. Si lugar ya es un .aviso,
     se pinta ahí; si no, va al principio de lugar y sustituye al que haya
     puesto antes. foco: true cuando responde a una acción de la persona. El
     marcado es el del contrato (<span class="aviso-texto">), así que sirve
     también dentro de un <p class="aviso">. */
  const TONOS_AVISO = {
    neutro: { clase: '', icono: 'info', rol: '' },
    advertencia: { clase: 'aviso-advertencia', icono: 'alerta', rol: '' },
    bloqueo: { clase: 'aviso-bloqueo', icono: 'error', rol: 'alert' },
    ok: { clase: 'aviso-ok', icono: 'ok', rol: 'status' }
  };
  function aviso(lugar, { tono = 'neutro', titulo = '', texto = '', foco = false } = {}) {
    const t = TONOS_AVISO[tono] || TONOS_AVISO.neutro;
    let a = lugar.classList.contains('aviso') ? lugar : $(':scope > [data-aviso-formkit]', lugar);
    if (!a) { a = document.createElement('div'); a.dataset.avisoFormkit = ''; lugar.prepend(a); }
    a.className = ['aviso', t.clase, ...[...a.classList].filter((c) => !/^aviso(-|$)/.test(c))].filter(Boolean).join(' ');
    if (t.rol) a.setAttribute('role', t.rol); else a.removeAttribute('role');
    const cuerpo = document.createElement('span');
    cuerpo.className = 'aviso-texto';
    if (titulo) { const h = document.createElement('strong'); h.className = 'aviso-titulo'; h.textContent = titulo; cuerpo.appendChild(h); }
    if (texto) cuerpo.appendChild(document.createTextNode(texto));
    a.replaceChildren(icono(t.icono), cuerpo);
    a.hidden = false;
    if (foco) { a.tabIndex = -1; a.focus(); }
    /* Sin rol ni foco nadie lo leería: se anuncia, y ya está a la vista. */
    else if (!t.rol) anuncia([titulo, texto].filter(Boolean).join(' '));
    return a;
  }

  /* ---------- Registro de módulos ----------
     Un módulo declara el selector que lo activa y una función iniciar(form,
     ctx). El núcleo lo llama sólo si el formulario contiene ese selector. */
  const modulos = new Map();
  function registra(nombre, def) { modulos.set(nombre, def); }

  /* ---------- Instancia ---------- */
  function iniciar(formulario, opciones = {}) {
    const form = typeof formulario === 'string' ? $(formulario) : formulario;
    if (!form) throw new Error(`FormKit: no existe el formulario «${formulario}»`);
    /* Un formulario se inicia una sola vez (P111): si ya arrancó solo al
       cargar, la llamada de la página le suma sus opciones (enviar, alEnviar…)
       y recibe la misma instancia, sin duplicar escuchas. */
    const previa = iniciados.get(form);
    if (previa) { Object.assign(previa.extra, opciones); return previa.instancia; }
    /* Opciones en dos capas. La de la página se lee en vivo (quien cambia
       FORMKIT_OPCIONES después de cargar lo ve aplicado) y una segunda llamada
       a iniciar le suma las suyas aparte, sin tocar las globales que comparten
       otros formularios. Encima, lo que escriben los módulos (el acuse
       encadena alEnviar), sólo para este formulario. */
    const base = opciones;
    const extra = {};
    const deModulos = {};
    const opcionesPagina = new Proxy({}, { get: (_, k) => (k in extra ? extra[k] : base[k]), has: (_, k) => k in extra || k in base });
    opciones = new Proxy({}, {
      get: (_, k) => (k in deModulos ? deModulos[k] : opcionesPagina[k]),
      set: (_, k, v) => { deModulos[k] = v; return true; },
      has: (_, k) => k in deModulos || k in opcionesPagina
    });
    const cfg = FormKit.config;
    const M = cfg.mensajes;
    const inicio = performance.now();
    form.setAttribute('novalidate', '');
    inyectaSprite();

    /* El estado de cada campo: dirty (se escribió), tocado (se salió de él). */
    const estado = new Map();
    const estadoDe = (n) => { if (!estado.has(n)) estado.set(n, { dirty: false, tocado: false }); return estado.get(n); };

    /* Tipos de campo que aportan los módulos (archivos, combo, mapa…).
       Cada uno declara cómo se lee su valor y su texto para la revisión. */
    const tipos = new Map();

    /* ----- Campos ----- */
    const envolturas = () => $$('[data-campo]', form);
    const envoltura = (n) => $(`[data-campo="${n}"]`, form);
    const nombres = () => envolturas().map((el) => el.dataset.campo);

    /* Un dato que calcula la página (data-auxiliar): no tiene controles, no
       se envía ni va al borrador, pero cuenta en condiciones y cruzadas. Su
       valor es el del input oculto (la envoltura misma o el que lleva dentro). */
    const valorAuxiliar = (el) => { const c = el.matches('input') ? el : $('input', el); return c ? String(c.value).trim() : String(el.dataset.valor || '').trim(); };

    function tipoDe(el) {
      if (el.hasAttribute('data-auxiliar')) return 'auxiliar';
      for (const [t, def] of tipos) if (def.detecta(el)) return t;
      if (el.matches('fieldset') || $$('input[type="radio"]', el).length > 1) return $$('input[type="checkbox"]', el).length > 1 ? 'multiple' : 'opcion';
      const c = $('input,select,textarea', el);
      if (c && c.type === 'checkbox') return $$('input[type="checkbox"]', el).length > 1 ? 'multiple' : 'casilla';
      if (c && c.tagName === 'SELECT') return 'select';
      return 'texto';
    }

    function controlesDe(n) {
      const el = envoltura(n);
      const t = tipoDe(el);
      if (t === 'auxiliar') return [];
      if (tipos.has(t)) return tipos.get(t).controles(el);
      if (t === 'opcion') return $$('input[type="radio"]', el);
      if (t === 'multiple') return $$('input[type="checkbox"]', el);
      return $$('input:not([type="hidden"]),select,textarea', el).filter((c) => !c.closest('[data-trampa]'));
    }
    const controlPrincipal = (n) => controlesDe(n)[0] || null;

    function valorDe(n) {
      const el = envoltura(n);
      const t = tipoDe(el);
      if (t === 'auxiliar') return valorAuxiliar(el);
      if (tipos.has(t)) return tipos.get(t).valorDe(el);
      if (t === 'opcion') { const r = $('input[type="radio"]:checked', el); return r ? r.value : ''; }
      if (t === 'multiple') return $$('input[type="checkbox"]:checked', el).map((c) => c.value);
      if (t === 'casilla') return $('input[type="checkbox"]', el).checked ? 'si' : '';
      const c = controlPrincipal(n);
      return c ? String(c.value).trim() : '';
    }

    function textoDeValor(n) {
      const el = envoltura(n);
      const t = tipoDe(el);
      if (t === 'auxiliar') return valorAuxiliar(el);
      if (tipos.has(t)) return tipos.get(t).textoDe(el);
      if (t === 'opcion') { const r = $('input[type="radio"]:checked', el); return r ? (textoDeOpcion(r)) : ''; }
      if (t === 'multiple') return $$('input[type="checkbox"]:checked', el).map(textoDeOpcion).join(', ');
      if (t === 'select') { const s = $('select', el); return s && s.value ? s.selectedOptions[0].textContent.trim() : ''; }
      if (t === 'casilla') return $('input', el).checked ? M.palabraSi : '';
      return valorDe(n);
    }
    function textoDeOpcion(input) {
      const lab = input.closest('label') || (input.id && $(`label[for="${input.id}"]`, form));
      const nombre = lab && ($('.opcion-nombre', lab) || lab);
      return nombre ? nombre.textContent.trim() : input.value;
    }

    /* Etiqueta visible del campo, sin la marca de obligatorio. */
    function etiquetaDe(n) {
      const el = envoltura(n);
      const e = $('.etiqueta', el) || $('legend,label', el);
      if (!e) return el.dataset.etiqueta || n;
      const c = e.cloneNode(true);
      $$('.marca-oblig,.solo-lector', c).forEach((x) => x.remove());
      const texto = c.textContent.replace(/\s+/g, ' ').trim();
      /* Dentro de un grupo repetible, la etiqueta dice de qué fila es: «Nombre (Acompañante 2)». */
      const fila = el.closest('.repetible-fila');
      const tituloFila = fila && $('.repetible-titulo', fila);
      return tituloFila && tituloFila.textContent.trim() ? `${texto} (${tituloFila.textContent.trim()})` : texto;
    }

    const esObligatorio = (n) => { const el = envoltura(n); return el.hasAttribute('data-requerido') || controlesDe(n).some((c) => c.required); };

    /* Un campo cuenta sólo si está activo: visible y sin un ancestro
       condicional oculto. El inactivo no se valida, no se revisa y no viaja. */
    function activo(n) {
      let el = envoltura(n);
      /* Un paso oculto no desactiva sus campos: sólo cambia qué se ve. */
      while (el && el !== form) { if (el.hidden && !el.hasAttribute('data-paso')) return false; el = el.parentElement; }
      return true;
    }

    /* Atributos de validación del control, leídos una vez por llamada. */
    function atributosDe(n) {
      const c = controlPrincipal(n) || envoltura(n);
      const a = {};
      for (const k of ['min', 'max', 'step', 'minlength', 'maxlength']) if (c.hasAttribute(k)) a[k] = c.getAttribute(k);
      if (c.hasAttribute('data-legible')) a.legible = true;
      for (const [k, v] of Object.entries(envoltura(n).dataset)) a[k] = v;
      /* Mínimo o máximo que dependen de otras respuestas: data-min-segun="clave"
         usa la función FORMKIT_CONFIG.limitesSegun[clave](datos); el servidor
         recibe la misma función en opciones.limitesSegun. */
      for (const [lim, clave] of [['min', a.minSegun], ['max', a.maxSegun]]) {
        const fn = clave && cfg.limitesSegun && cfg.limitesSegun[clave];
        if (typeof fn !== 'function') continue;
        const r = fn(datosActuales());
        if (r !== undefined && r !== null && r !== '') a[lim] = String(r);
      }
      return a;
    }
    /* Valores de los campos activos, para las funciones que dependen de otras respuestas. */
    const datosActuales = () => Object.fromEntries(nombres().filter((m) => activo(m)).map((m) => [m, valorDe(m)]));

    /* Ayuda de bloque (.ayuda-bloque): una sola ayuda bajo el título de una
       sección que vale igual para todos sus campos (nombre y apellidos). Cubre
       los campos que le siguen dentro de su contenedor, hasta el siguiente
       título o la siguiente ayuda de bloque, y se enlaza a cada uno. */
    function ayudasDeBloque(el) {
      const ids = [];
      for (const ab of $$('.ayuda-bloque', form)) {
        if (!ab.textContent.trim()) continue;
        for (let s = ab.nextElementSibling; s; s = s.nextElementSibling) {
          if (/^H[1-6]$/.test(s.tagName) || s.classList.contains('ayuda-bloque')) break;
          if (s === el || s.contains(el)) { ab.id = ab.id || idUnico('ayuda-bloque'); ids.push(ab.id); break; }
        }
      }
      return ids;
    }

    /* ----- Preparación de cada campo ----- */
    function preparaCampo(n) {
      const el = envoltura(n);
      const t = tipoDe(el);
      if (t === 'auxiliar') return;
      const etq = $('.etiqueta', el);
      if (etq && esObligatorio(n) && !$('.marca-oblig', etq)) {
        const ast = document.createElement('span');
        ast.className = 'marca-oblig';
        ast.setAttribute('aria-hidden', 'true');
        ast.textContent = '*';
        const pal = document.createElement('span');
        pal.className = 'solo-lector';
        pal.textContent = ` (${M.palabraObligatorio})`;
        etq.append(ast, pal);
      }
      const ayuda = $('.ayuda', el);
      if (ayuda && !ayuda.id) ayuda.id = idUnico(`ayuda-${n}`);

      let err = $('.err', el);
      if (!err) {
        err = document.createElement('p');
        err.className = 'err';
        err.append(icono('error', 'icono icono-sm err-icono'), document.createElement('span'));
        /* El error va al final de la envoltura: después del control y de la
           lista de opciones, nunca entre la etiqueta y el control. */
        el.appendChild(err);
      }
      err.id = err.id || idUnico(`err-${n}`);

      const deBloque = ayudasDeBloque(el);
      for (const c of controlesDe(n)) {
        const ids = [...deBloque, ayuda && ayuda.textContent.trim() ? ayuda.id : '', err.id].filter(Boolean).join(' ');
        c.setAttribute('aria-describedby', ids);
        /* aria-required sólo en controles de formulario: un botón (la zona de
           carga de archivos) no lo admite; ahí lo dicen el asterisco y el error. */
        if (esObligatorio(n) && /^(INPUT|SELECT|TEXTAREA)$/.test(c.tagName) && c.type !== 'radio' && c.type !== 'checkbox') c.setAttribute('aria-required', 'true');
        const f = cfg.formatos[el.dataset.formato];
        if (f && f.inputmode && !c.hasAttribute('inputmode') && c.tagName === 'INPUT') c.setAttribute('inputmode', f.inputmode);
        if (c.tagName === 'INPUT' && !c.hasAttribute('enterkeyhint') && c.type !== 'radio' && c.type !== 'checkbox' && c.type !== 'file') c.setAttribute('enterkeyhint', 'next');
      }

      /* Fecha y hora: límites por omisión (hoy) cuando el campo lo declara. */
      const ctl = controlPrincipal(n);
      if (ctl && el.dataset.formato === 'fecha' && el.hasAttribute('data-no-futura') && !ctl.max) ctl.max = cfg.hoyISO();

      /* Contraseña: botón «Mostrar» / «Ocultar» dentro del campo, a la derecha
         (aria-pressed), para revisar lo escrito; el control va en
         .contrasena-caja, que en una .fila ocupa el renglón del control. Se
         omite con data-sin-mostrar en el campo. */
      if (ctl && ctl.type === 'password' && !el.hasAttribute('data-sin-mostrar') && !$('[data-ver-contrasena]', el)) {
        if (!ctl.id) ctl.id = idUnico(`c-${n}`);
        let caja = ctl.closest('.contrasena-caja');
        if (!caja) { caja = document.createElement('div'); caja.className = 'contrasena-caja'; ctl.replaceWith(caja); caja.appendChild(ctl); }
        const ver = document.createElement('button');
        ver.type = 'button';
        ver.className = 'contrasena-ver';
        ver.dataset.verContrasena = '';
        ver.setAttribute('aria-pressed', 'false');
        ver.setAttribute('aria-controls', ctl.id);
        const t = document.createElement('span'); t.dataset.verTexto = ''; t.textContent = M.contrasenaMostrar;
        const lector = document.createElement('span'); lector.className = 'solo-lector'; lector.textContent = plantilla(M.contrasenaLector, { etiqueta: etiquetaDe(n) }); /* nombre único: «Mostrar: Contraseña», «Mostrar: Confirma tu contraseña» */
        ver.append(t, lector);
        caja.appendChild(ver);
      }

      /* Texto largo: contador y crecimiento automático. */
      const area = t === 'texto' ? $('textarea', el) : null;
      if (area) {
        if (area.maxLength > 0 && !$('.contador', el)) {
          const cont = document.createElement('p');
          cont.className = 'contador';
          cont.setAttribute('aria-hidden', 'true');
          area.insertAdjacentElement('afterend', cont);
        }
        actualizaContador(n);
        autoAlto(area);
      }
    }

    function actualizaContador(n) {
      const el = envoltura(n);
      const cont = $('.contador', el);
      const area = $('textarea', el);
      if (cont && area) cont.textContent = `${area.value.length} / ${area.maxLength}`;
    }
    function autoAlto(area) { area.style.height = 'auto'; area.style.height = `${area.scrollHeight}px`; }

    /* ----- Validación individual ----- */
    function normalizaCampo(n) {
      const el = envoltura(n);
      const f = cfg.formatos[el.dataset.formato];
      const c = controlPrincipal(n);
      if (!f || !c || c.tagName === 'SELECT' || c.type === 'file' || c.type === 'checkbox' || c.type === 'radio') return;
      const limpio = f.normaliza(c.value);
      if (limpio !== c.value) c.value = limpio;
    }

    function validaCampo(n) {
      if (!activo(n)) return '';
      const el = envoltura(n);
      const t = tipoDe(el);
      if (t === 'auxiliar') return '';
      const v = valorDe(n);
      const vacio = Array.isArray(v) ? v.length === 0 : !v;
      const datos = { etiqueta: etiquetaDe(n) };
      if (vacio) {
        if (!esObligatorio(n)) return '';
        if (el.dataset.mensaje) return el.dataset.mensaje;
        const clave = { opcion: 'obligatorioOpcion', multiple: 'obligatorioOpcion', select: 'obligatorioOpcion', casilla: 'obligatorioCasilla', archivos: 'obligatorioArchivos', combo: 'obligatorioOpcion' }[t] || 'obligatorioTexto';
        return plantilla(M[clave], datos);
      }
      if (t === 'multiple') {
        const a = atributosDe(n);
        if (a.minOpciones && v.length < Number(a.minOpciones)) return plantilla(M.minimoOpciones, { ...datos, min: a.minOpciones });
        if (a.maxOpciones && v.length > Number(a.maxOpciones)) return plantilla(M.maximoOpciones, { ...datos, max: a.maxOpciones });
        return '';
      }
      if (tipos.has(t) && tipos.get(t).valida) return tipos.get(t).valida(el, v, atributosDe(n)) || '';
      if (t === 'casilla' || t === 'opcion' || t === 'select') return '';
      const a = atributosDe(n);
      const nombreFormato = el.dataset.formato || ($('textarea', el) || a.legible ? 'texto' : '');
      const f = cfg.formatos[nombreFormato];
      if (f) {
        const msg = f.valida(f.normaliza(v), a, cfg);
        if (msg) return msg;
      } else if (a.minlength && v.length < Number(a.minlength)) return plantilla(M.minimoCaracteres, { ...datos, min: a.minlength, n: v.length });
      return '';
    }

    /* Sugerencia sin bloqueo (por ejemplo, dominio de correo mal escrito). */
    function sugerenciaDe(n) {
      const el = envoltura(n);
      const f = cfg.formatos[el.dataset.formato];
      return f && f.sugiere ? f.sugiere(valorDe(n), cfg) : '';
    }

    function marca(n, mensaje, nivel = 'error') {
      const el = envoltura(n);
      const err = $('.err', el);
      if (!err) return;
      if (nivel === 'error') for (const c of controlesDe(n)) c.setAttribute('aria-invalid', 'true');
      err.dataset.nivel = nivel;
      err.lastElementChild.textContent = `${nivel === 'error' ? M.prefijoError : M.advertencia} ${mensaje}`;
      $('use', err).setAttribute('href', nivel === 'error' ? '#i-error' : '#i-alerta');
    }

    function limpia(n) {
      const el = envoltura(n);
      for (const c of controlesDe(n)) c.removeAttribute('aria-invalid');
      const err = $('.err', el);
      if (err) {
        /* Si este campo mostraba una cruzada, los otros campos que marcó también se liberan. */
        for (const otro of (err.dataset.cruzadaCampos || '').split(' ').filter(Boolean)) if (otro !== n && envoltura(otro)) for (const c of controlesDe(otro)) { c.removeAttribute('aria-invalid'); c.setAttribute('aria-describedby', (c.getAttribute('aria-describedby') || '').split(' ').filter((x) => x && x !== err.id).join(' ')); }
        err.lastElementChild.textContent = ''; delete err.dataset.nivel; delete err.dataset.cruzada; delete err.dataset.cruzadaCampos;
      }
      /* Si este campo participa en una cruzada que marcó al otro, también se limpia. */
      for (const otro of camposCruzadosCon(n)) { const e2 = $('.err', envoltura(otro)); if (e2 && e2.dataset.cruzada === n) { e2.lastElementChild.textContent = ''; delete e2.dataset.cruzada; delete e2.dataset.nivel; for (const c of controlesDe(otro)) c.removeAttribute('aria-invalid'); } }
    }

    /* ----- Validaciones cruzadas -----
       Se declaran en el campo que muestra el mensaje:
         data-cruzada="curp-fecha" data-cruzada-campos="curp=curp fecha=nacimiento"
         data-cruzada-nivel="advertencia"  (opcional: degrada el bloqueo) */
    function cruzadasDe(n) {
      const el = envoltura(n);
      if (!el.dataset.cruzada) return [];
      return el.dataset.cruzada.split(/\s+/).filter(Boolean).map((clave, i) => {
        const mapa = {};
        for (const par of (el.dataset.cruzadaCampos || '').split(/\s+/).filter(Boolean)) { const [rol, campo] = par.split('='); mapa[rol] = campo || rol; }
        return { clave, mapa, nivel: el.dataset.cruzadaNivel || (cfg.cruzadas[clave] && cfg.cruzadas[clave].bloquea === false ? 'advertencia' : 'error'), indice: i };
      });
    }
    function camposCruzadosCon(n) {
      const out = new Set();
      for (const m of nombres()) for (const c of cruzadasDe(m)) if (Object.values(c.mapa).includes(n) || m === n) { out.add(m); for (const v of Object.values(c.mapa)) out.add(v); }
      out.delete(n);
      return [...out];
    }
    /* Campos que declaran una cruzada en la que participa n. */
    function declarantesDe(n) {
      return nombres().filter((m) => m !== n && cruzadasDe(m).some((c) => Object.values(c.mapa).includes(n)));
    }
    function validaCruzadas(n) {
      const resultados = [];
      for (const c of cruzadasDe(n)) {
        const def = cfg.cruzadas[c.clave];
        if (!def) continue;
        const valores = {};
        let listo = true;
        /* Un rol declarado en def.opcionales corre vacío: así se puede exigir
           algo justo cuando ese dato falta (sin segundo apellido, X en la CURP). */
        const opcionales = def.opcionales || [];
        for (const rol of def.campos) {
          const campo = c.mapa[rol] || rol;
          const v = envoltura(campo) && activo(campo) ? valorDe(campo) : '';
          if (!v && opcionales.includes(rol)) { valores[rol] = ''; continue; }
          if (!v || validaCampo(campo)) { listo = false; break; }
          const f = cfg.formatos[envoltura(campo).dataset.formato];
          valores[rol] = f ? f.normaliza(v) : v;
        }
        if (!listo) continue;
        const extra = { ...envoltura(n).dataset };
        if (extra.catalogo && global.FORMKIT_CATALOGOS) { const cat = global.FORMKIT_CATALOGOS[extra.catalogo]; extra.catalogo = cat && cat.filas ? cat.filas : cat; }
        const msg = def.valida(valores, extra, cfg);
        if (msg) resultados.push({ mensaje: msg, nivel: c.nivel, campos: Object.values(c.mapa) });
      }
      return resultados;
    }

    /* Valida un campo con sus cruzadas y pinta el resultado. Devuelve el
       mensaje bloqueante o ''. */
    function validaYPinta(n) {
      const msg = validaCampo(n);
      if (msg) { marca(n, msg); return msg; }
      limpia(n);
      const cruz = validaCruzadas(n);
      const bloquea = cruz.find((c) => c.nivel === 'error');
      const aviso = cruz.find((c) => c.nivel !== 'error');
      if (bloquea) {
        marca(n, bloquea.mensaje);
        const err = $('.err', envoltura(n));
        err.dataset.cruzada = n;
        err.dataset.cruzadaCampos = bloquea.campos.join(' ');
        for (const otro of bloquea.campos) if (otro !== n) for (const c of controlesDe(otro)) { c.setAttribute('aria-invalid', 'true'); if (!(c.getAttribute('aria-describedby') || '').includes(err.id)) c.setAttribute('aria-describedby', `${c.getAttribute('aria-describedby') || ''} ${err.id}`.trim()); }
        return bloquea.mensaje;
      }
      if (aviso) { marca(n, aviso.mensaje, 'advertencia'); return ''; }
      /* Sugerencias sin bloqueo: la del formato (dominio de correo) y las que
         registren los módulos (por ejemplo, «Otro» que repite una opción). */
      let sug = sugerenciaDe(n);
      for (const fn of ctx.sugerencias) if (!sug) sug = fn(n) || '';
      if (sug) marca(n, sug, 'advertencia');
      return '';
    }

    /* Valida todos los campos activos de un contenedor (paso o formulario). */
    function validaContenedor(cont) {
      const fallos = [];
      for (const el of $$('[data-campo]', cont)) {
        const n = el.dataset.campo;
        if (!activo(n)) { limpia(n); continue; }
        estadoDe(n).tocado = true;
        normalizaCampo(n);
        const msg = validaYPinta(n);
        if (msg) fallos.push({ campo: n, mensaje: msg });
      }
      return fallos;
    }

    /* ----- Resumen de errores (FRM-28) ----- */
    function quitaResumen(cont = form) { for (const r of $$('.resumen-errores', cont)) r.remove(); }

    /* El resumen dice de qué respuesta se trata: si varias tienen la misma
       etiqueta («Decisión» en cada documento), data-contexto en el campo o en
       un elemento que lo rodea («Identificación oficial») va antes del mensaje. */
    function contextoDe(n) {
      const e = envoltura(n);
      const c = e && e.closest('[data-contexto]');
      return c ? c.dataset.contexto.trim() : '';
    }

    /* origen 'servidor': el título dice que el envío no se completó. */
    function muestraResumen(cont, fallos, origen = '') {
      quitaResumen(cont);
      if (!fallos.length) return null;
      const r = document.createElement('div');
      r.className = 'resumen-errores';
      r.setAttribute('role', 'alert');
      r.tabIndex = -1;
      const tit = document.createElement('p');
      tit.className = 'resumen-errores-titulo';
      const n = fallos.length;
      const titulo = origen === 'servidor'
        ? (n === 1 ? M.resumenServidorUno : plantilla(M.resumenServidorVarios, { n }))
        : (n === 1 ? M.resumenUno : plantilla(M.resumenVarios, { n }));
      tit.append(icono('error'), document.createTextNode(titulo));
      const ul = document.createElement('ul');
      ul.className = 'resumen-errores-lista';
      for (const f of fallos) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'resumen-errores-enlace';
        const c = controlPrincipal(f.campo);
        if (c && !c.id) c.id = idUnico(`c-${f.campo}`);
        a.href = `#${c ? c.id : ''}`;
        a.dataset.irCampo = f.campo;
        const contexto = contextoDe(f.campo);
        a.textContent = contexto ? plantilla(M.resumenContexto, { contexto, mensaje: f.mensaje }) : f.mensaje;
        li.appendChild(a);
        ul.appendChild(li);
      }
      r.append(tit, ul);
      /* Antes del primer campo del contenedor, después del título y la bajada. */
      const primero = $('[data-campo],.leyenda-oblig', cont);
      if (primero && primero.parentNode === cont) cont.insertBefore(r, primero); else cont.prepend(r);
      r.focus();
      return r;
    }

    function enfocaCampo(n) {
      const ctls = controlesDe(n);
      const ctl = ctls.find((x) => x.type !== 'radio' || x.checked) || ctls[0];
      if (ctl) ctl.focus();
    }

    /* Cuando ya no queda ningún campo con error, el resumen sobra. */
    function revisaResumen() {
      if (!$('[aria-invalid="true"]', form)) quitaResumen();
    }

    /* ----- Visibilidad condicional -----
       data-si="campo=valor|valor2" en cualquier elemento. El valor de un grupo
       de casillas cuenta si alguna marcada coincide. Oculto = inactivo, y lo
       escrito dentro se conserva (la opción «Otro» recupera su texto). */
    /* Un campo oculto no tiene valor para las condiciones: lo que dependía de
       él también se oculta (condiciones encadenadas, igual que en el servidor). */
    function valorParaCondicion(nombre) {
      if (envoltura(nombre)) { if (!activo(nombre)) return []; const v = valorDe(nombre); return Array.isArray(v) ? v : [v]; }
      const ctls = $$(`[name="${nombre}"]`, form);
      const marcados = ctls.filter((c) => (c.type === 'radio' || c.type === 'checkbox') ? c.checked : true);
      return marcados.map((c) => c.value);
    }
    function aplicaCondicionales() {
      /* Se repite hasta que nada cambie: ocultar un campo puede ocultar lo que dependía de él. */
      for (let vuelta = 0, cambio = true; cambio && vuelta < 20; vuelta++) {
        cambio = false;
        for (const el of $$('[data-si]', form)) {
          const [campo, lista] = el.dataset.si.split('=');
          const admitidos = (lista || '').split('|');
          const actuales = valorParaCondicion(campo.trim());
          const visible = actuales.some((v) => admitidos.includes(v));
          if (el.hidden === visible) {
            el.hidden = !visible;
            cambio = true;
            /* Un campo que se oculta pierde su error: ya no cuenta. */
            if (!visible) for (const c of $$('[data-campo]', el)) limpia(c.dataset.campo);
            if (el.hasAttribute('data-campo') && !visible) limpia(el.dataset.campo);
          }
        }
      }
    }

    /* ----- Borrador local -----
       Se activa con data-borrador="clave" en el <form>. Versionado con
       data-borrador-version. Excluye campos data-sensible y archivos. */
    const claveBorrador = form.dataset.borrador || '';
    const versionBorrador = form.dataset.borradorVersion || '1';
    let temporizadorBorrador = 0;
    let temporizadorGuardado = 0;
    let arrancado = false;
    let terminado = false;
    const indicador = $('[data-guardado]');
    const franja = $('[data-franja-borrador]');

    function programaBorrador() {
      if (!claveBorrador || !arrancado || terminado) return;
      clearTimeout(temporizadorBorrador);
      temporizadorBorrador = setTimeout(escribeBorrador, cfg.borrador.retardoMs);
    }
    function datosBorrador() {
      const datos = {};
      for (const n of nombres()) {
        const el = envoltura(n);
        if (el.hasAttribute('data-sensible') || tipoDe(el) === 'auxiliar' || tipos.has(tipoDe(el)) && !tipos.get(tipoDe(el)).enBorrador) continue;
        datos[n] = valorDe(n);
      }
      return datos;
    }
    function escribeBorrador() {
      const extra = FormKit.ganchos.estadoBorrador ? FormKit.ganchos.estadoBorrador(form) : {};
      const ok = almacen.escribe(claveBorrador, JSON.stringify({ v: versionBorrador, t: Date.now(), datos: datosBorrador(), ...extra }));
      if (ok && indicador) {
        indicador.textContent = M.borradorGuardado;
        indicador.setAttribute('data-visible', '');
        clearTimeout(temporizadorGuardado);
        temporizadorGuardado = setTimeout(() => indicador.removeAttribute('data-visible'), cfg.borrador.visibleMs);
      }
    }
    /* Si la persona cierra o cambia de pestaña antes de que venza el retardo,
       el borrador pendiente se escribe en ese momento. */
    window.addEventListener('pagehide', () => { if (temporizadorBorrador && claveBorrador && arrancado && !terminado) { clearTimeout(temporizadorBorrador); escribeBorrador(); } });

    function leeBorrador() {
      const crudo = almacen.lee(claveBorrador);
      if (!crudo) return null;
      try {
        const b = JSON.parse(crudo);
        if (b.v !== versionBorrador || Date.now() - b.t > cfg.borrador.ttlDias * MS_POR_DIA) { almacen.borra(claveBorrador); return null; }
        return b;
      } catch (e) { almacen.borra(claveBorrador); return null; }
    }
    function restauraBorrador(b) {
      for (const [n, v] of Object.entries(b.datos || {})) {
        const el = envoltura(n);
        if (!el) continue;
        const t = tipoDe(el);
        if (tipos.has(t)) { if (tipos.get(t).restaura) tipos.get(t).restaura(el, v); continue; }
        if (t === 'opcion') { const r = $$('input[type="radio"]', el).find((x) => x.value === v); if (r) r.checked = true; }
        else if (t === 'multiple') $$('input[type="checkbox"]', el).forEach((c) => { c.checked = (v || []).includes(c.value); });
        else if (t === 'casilla') $('input', el).checked = !!v;
        else { const c = controlPrincipal(n); if (c) { c.value = v; if (c.tagName === 'SELECT') c.toggleAttribute('data-vacio', !c.value); } }
      }
      aplicaCondicionales();
      for (const n of nombres()) { actualizaContador(n); const a = $('textarea', envoltura(n)); if (a) autoAlto(a); }
      if (FormKit.ganchos.restauraBorrador) FormKit.ganchos.restauraBorrador(form, b);
      anuncia(M.borradorGuardado.replace('guardado', 'recuperado'));
    }
    function iniciaFranja(b) {
      franja.hidden = false;
      const f = $('[data-borrador-fecha]', franja);
      if (f) f.textContent = new Date(b.t).toLocaleString(cfg.idioma, { dateStyle: 'long', timeStyle: 'short' });
      franja.addEventListener('click', (e) => {
        const a = e.target.closest('[data-borrador]');
        if (!a) return;
        const confirma = $('[data-borrador-confirma]', franja);
        if (a.dataset.borrador === 'recuperar') { restauraBorrador(b); franja.hidden = true; }
        else if (a.dataset.borrador === 'descartar') { if (confirma) { confirma.hidden = false; const si = $('[data-borrador="descartar-si"]', franja); if (si) si.focus(); } else { almacen.borra(claveBorrador); franja.hidden = true; } }
        else if (a.dataset.borrador === 'descartar-si') { almacen.borra(claveBorrador); franja.hidden = true; }
        else if (a.dataset.borrador === 'conservar') { confirma.hidden = true; $('[data-borrador="recuperar"]', franja).focus(); }
      });
    }

    /* ----- Envío ----- */
    function arma() {
      const datos = {};
      for (const n of nombres()) {
        if (!activo(n)) continue;
        const el = envoltura(n);
        const t = tipoDe(el);
        if (t === 'auxiliar' || (tipos.has(t) && tipos.get(t).fueraDeDatos)) continue;
        normalizaCampo(n);
        const v = valorDe(n);
        if (Array.isArray(v) ? v.length : v) datos[n] = v;
      }
      const trampa = $('[data-trampa] input, input[data-trampa]', form);
      const payload = { datos, meta: { version_formulario: versionBorrador, ms_en_formulario: Math.round(performance.now() - inicio), trampa: trampa ? trampa.value : '', idempotencia: claveIdempotencia() } };
      for (const def of tipos.values()) if (def.alArmar) def.alArmar(form, payload);
      return payload;
    }
    /* La clave de idempotencia es la misma mientras no se logre enviar: si
       la persona reintenta, el servidor reconoce el duplicado. */
    let idempotencia = '';
    function claveIdempotencia() { if (!idempotencia) idempotencia = (global.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; return idempotencia; }

    function envioPorOmision(payload, { signal }) {
      const destino = form.getAttribute('action');
      if (!destino || destino === '#') return Promise.reject(new Error('FormKit: el formulario no declara action ni opciones.enviar'));
      return fetch(destino, { method: form.getAttribute('method') || 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': payload.meta.idempotencia }, body: JSON.stringify(payload), signal })
        .then(async (r) => {
          if (r.status === 429) { const e = new Error('limite'); e.limite = true; throw e; }
          if (!r.ok) {
            /* Un rechazo con {errores: [{campo, mensaje}]}, la misma forma que devuelve validar.mjs, se pinta en cada campo. */
            const e = new Error(`HTTP ${r.status}`);
            const cuerpo = await r.json().catch(() => null);
            if (cuerpo && Array.isArray(cuerpo.errores)) e.errores = cuerpo.errores;
            throw e;
          }
          return r.json();
        });
    }

    /* Marca un campo con un error que viene de fuera (por ejemplo, del
       servidor: «Ya hay una cuenta con esta CURP»). Devuelve false si el
       campo no existe en este formulario. */
    function marcaError(n, mensaje) {
      if (!envoltura(n)) return false;
      estadoDe(n).tocado = true;
      marca(n, mensaje);
      return true;
    }

    function botonEnviar() { return $('[data-accion="enviar"],button[type="submit"]', form); }

    async function enviar() {
      /* Al enviar, la contraseña vuelve a ocultarse: que el navegador no la guarde ni la muestre como texto. */
      for (const b of $$('[data-ver-contrasena][aria-pressed="true"]', form)) verContrasena(b, false);
      /* Un módulo (pasos) puede validar por su cuenta; si devuelve null, el formulario no es suyo. */
      const porModulo = FormKit.ganchos.validaTodo ? FormKit.ganchos.validaTodo(form) : null;
      const fallos = porModulo || validaContenedor(form);
      if (fallos.length) { if (!porModulo) muestraResumen(form, fallos); return false; }
      const boton = botonEnviar();
      const avisoEnvio = $('[data-estado-envio]', form);
      if (avisoEnvio) avisoEnvio.hidden = true;
      const textoOriginal = boton ? boton.textContent : '';
      if (boton) { boton.setAttribute('aria-disabled', 'true'); boton.setAttribute('aria-busy', 'true'); boton.textContent = M.enviando; }
      const control = new AbortController();
      const plazo = setTimeout(() => control.abort(), cfg.envio.timeoutMs);
      try {
        for (const def of tipos.values()) if (def.antesDeEnviar) await def.antesDeEnviar(form);
        const enviarFn = opciones.enviar || envioPorOmision;
        const respuesta = await enviarFn(arma(), { signal: control.signal });
        terminado = true;
        clearTimeout(temporizadorBorrador);
        if (claveBorrador) almacen.borra(claveBorrador);
        if (opciones.alEnviar) opciones.alEnviar(respuesta, form); else form.dispatchEvent(new CustomEvent('formkit:enviado', { detail: respuesta }));
        return true;
      } catch (e) {
        /* Errores por campo devueltos por el servidor: junto a cada campo y en el resumen. */
        const porCampo = e && Array.isArray(e.errores) ? e.errores.filter((x) => x && marcaError(x.campo, x.mensaje)) : [];
        if (porCampo.length) {
          const fallos = porCampo.map((x) => ({ campo: x.campo, mensaje: x.mensaje }));
          if (!(FormKit.ganchos.erroresServidor && FormKit.ganchos.erroresServidor(form, fallos))) muestraResumen(form, fallos, 'servidor');
          if (opciones.alFallar) opciones.alFallar(e, form);
          return false;
        }
        const texto = e && e.limite ? M.envioLimite : control.signal.aborted ? M.envioTimeout : M.envioError;
        if (avisoEnvio) { $('.aviso-texto', avisoEnvio).textContent = texto; avisoEnvio.hidden = false; avisoEnvio.focus(); } else anuncia(texto, true);
        if (opciones.alFallar) opciones.alFallar(e, form);
        return false;
      } finally {
        clearTimeout(plazo);
        if (boton) { boton.removeAttribute('aria-disabled'); boton.removeAttribute('aria-busy'); boton.textContent = textoOriginal; }
      }
    }

    /* ----- Eventos (todos aquí; ninguno en el HTML) ----- */
    form.addEventListener('submit', (e) => { e.preventDefault(); if (!(FormKit.ganchos.submit && FormKit.ganchos.submit(form, enviar))) enviar(); });

    /* Después de validar n: las cruzadas que otro campo declara con n se
       repiten si ese campo ya tiene valor (la CURP escrita y luego otra
       fecha), y los límites que dependen de otras respuestas se recalculan
       en los campos ya tocados. */
    function revalidaDependientes(n) {
      for (const d of declarantesDe(n)) if (activo(d) && valorDe(d)) validaYPinta(d);
      for (const el of $$('[data-min-segun],[data-max-segun]', form)) {
        const m = el.dataset.campo;
        if (m && m !== n && activo(m) && estadoDe(m).tocado && valorDe(m)) validaYPinta(m);
      }
    }

    /* Muestra u oculta la contraseña: tipo del control, texto del botón y aria-pressed. */
    function verContrasena(b, ver) {
      const c = document.getElementById(b.getAttribute('aria-controls'));
      if (!c) return;
      c.type = ver ? 'text' : 'password';
      b.setAttribute('aria-pressed', String(ver));
      const t = $('[data-ver-texto]', b);
      if (t) t.textContent = ver ? M.contrasenaOcultar : M.contrasenaMostrar;
    }

    form.addEventListener('click', (e) => {
      const ver = e.target.closest('[data-ver-contrasena]');
      if (ver && form.contains(ver)) { verContrasena(ver, ver.getAttribute('aria-pressed') !== 'true'); return; }
      const b = e.target.closest('[data-ir-campo],[data-accion="enviar"],[aria-disabled="true"]');
      if (!b || !form.contains(b)) return;
      if (b.getAttribute('aria-disabled') === 'true') { e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (b.dataset.irCampo) { e.preventDefault(); enfocaCampo(b.dataset.irCampo); return; }
      if (b.dataset.accion === 'enviar' && b.type !== 'submit') enviar();
    });

    /* Decisión C5: el error aparece al salir del campo la primera vez; una vez
       marcado, se revalida en cada pulsación para que desaparezca en cuanto se
       corrige. Nunca aparece en un campo que la persona no ha tocado. */
    form.addEventListener('input', (e) => {
      const el = e.target.closest('[data-campo]');
      aplicaCondicionales();
      if (el) {
        const n = el.dataset.campo;
        estadoDe(n).dirty = true;
        if (e.target.matches('textarea')) { autoAlto(e.target); actualizaContador(n); }
        if (e.target.matches('select')) e.target.toggleAttribute('data-vacio', !e.target.value);
        const err = $('.err', el);
        if (err && err.dataset.nivel === 'error') { const msg = validaCampo(n); if (!msg) { limpia(n); const cruz = validaCruzadas(n).find((c) => c.nivel === 'error'); if (cruz) marca(n, cruz.mensaje); } else marca(n, msg); revisaResumen(); }
        for (const otro of camposCruzadosCon(n)) { const e2 = $('.err', envoltura(otro)); if (e2 && e2.dataset.cruzada) validaYPinta(otro); }
        /* Un dato calculado por la página no tiene «salir del campo»: lo que depende de él se revisa al cambiar. */
        if (tipoDe(el) === 'auxiliar') { revalidaDependientes(n); revisaResumen(); }
      }
      programaBorrador();
    });
    form.addEventListener('change', (e) => {
      const el = e.target.closest('[data-campo]');
      aplicaCondicionales();
      if (el) {
        const n = el.dataset.campo;
        estadoDe(n).dirty = true;
        /* Las opciones, casillas, selects y fechas se validan al cambiar: no hay «salir del campo» útil. */
        const err = $('.err', el);
        if (e.target.matches('input[type="radio"],input[type="checkbox"],select,input[type="date"],input[type="time"],input[type="file"]')) { if (estadoDe(n).tocado || (err && err.dataset.nivel)) validaYPinta(n); revalidaDependientes(n); revisaResumen(); }
        else if (err && err.dataset.nivel) { validaYPinta(n); revisaResumen(); }
      }
      programaBorrador();
    });
    form.addEventListener('focusout', (e) => {
      const el = e.target.closest('[data-campo]');
      if (!el || !e.target.matches('input,textarea,select')) return;
      /* Pasar a otro control del MISMO campo (día → mes) no es salir; pasar a su botón («Hoy») sí. */
      if (e.relatedTarget && el.contains(e.relatedTarget) && e.relatedTarget.matches('input,select,textarea')) return;
      const n = el.dataset.campo;
      const st = estadoDe(n);
      if (!st.dirty && !valorDe(n)) return; // ni tocó ni escribió: no se regaña
      st.tocado = true;
      normalizaCampo(n);
      if (e.target.matches('textarea')) actualizaContador(n);
      const msg = validaYPinta(n);
      if (msg) anuncia(`${M.prefijoError} ${msg}`);
      revalidaDependientes(n);
      revisaResumen();
    });

    /* Diálogos y copiado los atiende su módulo. El anuncio de envío fallido se
       oculta cuando la persona cambia un dato, no cuando otro elemento recibe
       el foco: al ocultarse con el foco, el botón de abajo subía a media
       pulsación y el clic se perdía. */
    const ocultaAvisoEnvio = () => { const a = $('[data-estado-envio]', form); if (a && !a.hidden) a.hidden = true; };
    form.addEventListener('input', ocultaAvisoEnvio);
    form.addEventListener('change', ocultaAvisoEnvio);

    /* ----- Contexto para los módulos ----- */
    const ctx = {
      form, cfg, M, opciones, opcionesPagina, tipos, sugerencias: [],
      $, $$, plantilla, icono, anuncia, almacen, idUnico, pesoTxt, normalizaBusqueda,
      envoltura, envolturas, nombres, tipoDe, controlesDe, controlPrincipal, valorDe, textoDeValor, etiquetaDe, esObligatorio, activo, atributosDe,
      validaCampo, validaYPinta, validaContenedor, marca, marcaError, limpia, muestraResumen, quitaResumen, revisaResumen, enfocaCampo,
      aplicaCondicionales, programaBorrador, leeBorrador, restauraBorrador, enviar, arma, preparaCampo, estadoDe, datosActuales
    };

    /* ----- Arranque ----- */
    const activos = [];
    for (const [nombre, def] of modulos) {
      const ambito = def.fueraDelFormulario ? document : form;
      if (!def.selector || $(def.selector, ambito)) { if (def.tipos) for (const [t, d] of Object.entries(def.tipos)) tipos.set(t, d); activos.push([nombre, def]); }
    }
    for (const n of nombres()) preparaCampo(n);
    for (const [, def] of activos) if (def.iniciar) def.iniciar(form, ctx);
    for (const s of $$('select', form)) s.toggleAttribute('data-vacio', !s.value);
    aplicaCondicionales();
    if (claveBorrador) {
      const previo = leeBorrador();
      if (previo) { if (franja) iniciaFranja(previo); else restauraBorrador(previo); }
    }
    arrancado = true;
    form.dataset.formkit = 'listo';

    const instancia = {
      ctx,
      modulos: activos.map(([n]) => n),
      payload: arma,
      valida: () => validaContenedor(form),
      enviar,
      marcaError,
      /* Inventario de datos personales: qué se pide, para qué y con qué finalidad (FRM-55). */
      inventario: () => nombres().map((n) => { const d = envoltura(n).dataset; return { campo: n, etiqueta: etiquetaDe(n), obligatorio: esObligatorio(n), uso: d.uso || '', datoPersonal: d.finalidad !== undefined, finalidad: d.finalidad || '', sensible: d.sensible !== undefined, formato: d.formato || '', autocomplete: controlPrincipal(n) ? controlPrincipal(n).getAttribute('autocomplete') || '' : '' }; })
    };
    instancias.push(instancia);
    iniciados.set(form, { instancia, extra });
    return instancia;
  }

  /* Formularios iniciados en la página, para marcar un error desde fuera
     sin tener a mano la instancia. */
  const instancias = [];
  /* Cada formulario iniciado, con sus opciones: para no iniciarlo dos veces (P111). */
  const iniciados = new WeakMap();
  const marcaErrorGlobal = (campo, mensaje) => instancias.some((i) => i.marcaError(campo, mensaje));

  const FormKit = {
    version: BASE.version,
    config: fusiona(BASE, global.FORMKIT_CONFIG || {}),
    registra, iniciar, anuncia, aviso, icono, almacen,
    /* FormKit.marcaError(campo, mensaje): pinta el error junto al campo, en el formulario que lo tenga. */
    marcaError: marcaErrorGlobal,
    utilidades: { $, $$, plantilla, pesoTxt, normalizaBusqueda, idUnico, fusiona },
    /* Ganchos que un módulo puede ocupar: validaTodo (pasos), submit, estadoBorrador, restauraBorrador, erroresServidor. */
    ganchos: {}
  };
  global.FormKit = FormKit;

  /* Arranque declarativo: todo <form data-formkit> se inicia solo al cargar
     la página, con la configuración global. Quien necesite opciones (enviar,
     alEnviar) llama FormKit.iniciar(form, opciones) desde su arranque. */
  document.addEventListener('DOMContentLoaded', () => {
    for (const f of $$('form[data-formkit=""]')) if (f.dataset.formkit !== 'listo') iniciar(f, global.FORMKIT_OPCIONES || {});
  });
}(window));
