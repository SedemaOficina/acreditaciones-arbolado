/* =========================================================
   archivos.js · Módulo «archivos» · nivel RECOMENDADO

   Zona de carga de archivos y fotografías. La zona es un botón real
   (teclado y lector de pantalla) que también recibe arrastrados; en el
   teléfono ofrece cámara y galería (botón aparte con capture). Dice los
   formatos y el límite ANTES de que la persona elija (FRM-51). Cada archivo
   tiene su estado (en espera, optimizando, listo, con error), vista previa
   si es imagen, botón de quitar y de reintentar.

   Validaciones en el navegador (el servidor las repite todas):
     · extensión en la lista; firma (primeros bytes) coherente con la
       extensión; tamaño mínimo (no vacío), máximo por archivo (medido
       DESPUÉS de optimizar) y total; número máximo;
     · duplicados por huella SHA-256 del original;
     · nombre saneado (sin rutas ni caracteres de control; el servidor
       asigna el nombre definitivo);
     · imágenes: dimensiones mínimas; optimización a --lado px / calidad;
       los metadatos EXIF (fecha y GPS) se leen y viajan sólo si la
       configuración lo pide (archivos.conservarExif, decisión C6); si no,
       la foto viaja sin ellos siempre que se puedan quitar.
   Un archivo soltado fuera de la zona no abre el navegador sobre él.

   Contrato HTML:
     <div class="campo" data-campo="fotos" data-requerido>
       <span class="etiqueta" id="et-fotos">Fotografías o documentos</span>
       <p class="ayuda">Ayudan a valorar el caso.</p>
       <div data-archivos>
         <button type="button" class="zona-carga" aria-describedby="…">
           <svg class="icono" aria-hidden="true"><use href="#i-adjunto"></use></svg>
           <span class="zona-carga-texto">Elegir archivos o arrastrarlos aquí</span>
           <span class="zona-carga-limite" data-limite-texto></span>
         </button>
         <button type="button" class="btn btn-secundario zona-camara" data-camara hidden>Tomar fotografía</button>
         <input type="file" hidden>
         <input type="file" accept="image/*" capture="environment" hidden data-entrada-camara>
         <div data-rechazos></div>
         <ul class="lista-arch"></ul>
       </div>
     </div>
   Para una fotografía de la persona (retrato) se usa la cámara frontal:
   capture="user" en lugar de capture="environment" (campo «Fotografía de frente»).
   Configuración por campo (opcional): data-extensiones="jpg,png", data-mb,
   data-max, data-total-mb. Lo demás viene de validaciones.config.js.
   Con el máximo cargado, [data-archivos] lleva data-lleno: se ocultan
   «Elegir archivo» y la cámara, y la frase .arch-lleno lo dice bajo la lista.
   Borrador: el estándar no guarda archivos en el dispositivo; la página
   puede dar un proveedor, FormKit.iniciar(form, { borradorArchivos:
   { guarda(campo, archivos), lee(campo), borra(campo) } }).
   Desde código: FormKit.archivos.de(el) (la lista de un campo) y
   FormKit.archivos.agrega(archivos, el).
   ========================================================= */
(function () {
  'use strict';
  const BYTES_POR_MB = 1048576;
  const archivosPorCampo = new WeakMap();

  FormKit.registra('archivos', {
    selector: '[data-archivos]',
    tipos: {
      archivos: {
        detecta: (el) => !!el.querySelector('[data-archivos]'),
        controles: (el) => [el.querySelector('.zona-carga')],
        valorDe: (el) => ((archivosPorCampo.get(el) || []).filter((a) => a.estado !== 'error').length ? String(archivosPorCampo.get(el).length) : ''),
        textoDe: (el) => (archivosPorCampo.get(el) || []).map((a) => a.nombre).join(', '),
        enBorrador: false,
        fueraDeDatos: true,
        alArmar: (form, payload) => {
          payload.archivos = [];
          for (const el of form.querySelectorAll('[data-campo]')) {
            const lista = archivosPorCampo.get(el);
            if (lista) for (const a of lista) if (a.estado !== 'error') payload.archivos.push({ campo: el.dataset.campo, nombre: a.nombre, tipo: a.tipo, size: a.size, original: a.original, sha256_original: a.sha256_original, optimizada: !!a.optimizada, dimensiones: a.dimensiones, fecha_captura: a.fecha_captura, lat_captura: a.lat_captura, lon_captura: a.lon_captura, blob: a.blob });
          }
        },
        antesDeEnviar: async (form) => { for (const el of form.querySelectorAll('[data-campo]')) for (const a of archivosPorCampo.get(el) || []) if (a.promesa) await a.promesa; }
      }
    },
    iniciar(form, ctx) {
      const { $, $$, cfg, M, plantilla, anuncia, pesoTxt, icono, limpia, programaBorrador } = ctx;
      const A = cfg.archivos;

      function configDe(el) {
        const d = el.dataset;
        return {
          extensiones: d.extensiones ? d.extensiones.split(',').map((s) => s.trim().toLowerCase()) : A.extensiones,
          mb: Number(d.mb || A.mb), mbTotal: Number(d.totalMb || A.mbTotal), max: Number(d.max || A.max),
          conservarExif: d.conservarExif !== undefined ? d.conservarExif !== 'false' : A.conservarExif
        };
      }
      const ext = (nombre) => String(nombre || '').split('.').pop().toLowerCase();
      const formatosTxt = (c) => cfg.formatosArchivo(c.extensiones);
      /* Nombre saneado: sin rutas, sin caracteres de control, acotado. */
      const saneaNombre = (n) => String(n || 'archivo').split(/[\\/]/).pop().replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim().slice(0, A.nombreMax) || 'archivo';
      const hexDe = (buf) => Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
      const huellaDe = (buf) => ((window.crypto && crypto.subtle && crypto.subtle.digest) ? crypto.subtle.digest('SHA-256', buf).then(hexDe, () => '') : Promise.resolve(''));

      /* Firma del archivo: los primeros bytes dicen qué es de verdad. */
      function firmaCoincide(buf, extension) {
        const firmas = A.firmas[extension];
        if (!firmas) return true; /* sin firma conocida no se rechaza: lo decide el servidor */
        const b = new Uint8Array(buf.slice(0, 12));
        if (extension === 'heic') return b.length > 8 && String.fromCharCode(b[4], b[5], b[6], b[7]) === 'ftyp';
        return firmas.some((f) => f.every((x, i) => b[i] === x));
      }

      /* Lector mínimo de EXIF (JPG): fecha de captura y coordenadas GPS. */
      function leeExif(buf) {
        const r = {};
        try {
          const v = new DataView(buf);
          if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return r;
          let o = 2;
          while (o + 4 <= v.byteLength) {
            const m = v.getUint16(o);
            if ((m & 0xFF00) !== 0xFF00 || m === 0xFFDA) break;
            const largo = v.getUint16(o + 2);
            if (m === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
              const t = o + 10;
              const le = v.getUint16(t) === 0x4949;
              const g16 = (p) => v.getUint16(p, le), g32 = (p) => v.getUint32(p, le);
              if (g16(t + 2) !== 42) return r;
              const ifd = (p) => { const n = g16(p); const e = {}; for (let i = 0; i < n; i++) { const q = p + 2 + i * 12; e[g16(q)] = { n: g32(q + 4), en: q + 8 }; } return e; };
              const txt = (x) => { const p = x.n > 4 ? t + g32(x.en) : x.en; let s = ''; for (let i = 0; i < x.n; i++) { const c = v.getUint8(p + i); if (!c) break; s += String.fromCharCode(c); } return s; };
              const racs = (x) => { const p = t + g32(x.en); const a = []; for (let i = 0; i < x.n; i++) { const d = g32(p + i * 8 + 4); a.push(d ? g32(p + i * 8) / d : 0); } return a; };
              const cero = ifd(t + g32(t + 4));
              let fecha = '';
              if (cero[0x8769]) { const ex = ifd(t + g32(cero[0x8769].en)); if (ex[0x9003]) fecha = txt(ex[0x9003]); }
              if (!fecha && cero[0x0132]) fecha = txt(cero[0x0132]);
              const f = fecha.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
              if (f) r.fecha = `${f[1]}-${f[2]}-${f[3]}T${f[4]}:${f[5]}:${f[6]}`;
              if (cero[0x8825]) {
                const g = ifd(t + g32(cero[0x8825].en));
                if (g[2] && g[4]) {
                  const la = racs(g[2]), lo = racs(g[4]);
                  let dla = la[0] + (la[1] || 0) / 60 + (la[2] || 0) / 3600, dlo = lo[0] + (lo[1] || 0) / 60 + (lo[2] || 0) / 3600;
                  if (g[1] && txt(g[1]) === 'S') dla = -dla;
                  if (g[3] && txt(g[3]) === 'W') dlo = -dlo;
                  if (dla || dlo) { r.lat = +dla.toFixed(6); r.lon = +dlo.toFixed(6); }
                }
              }
              return r;
            }
            o += 2 + largo;
          }
        } catch (e) { /* un EXIF dañado no impide agregar la foto */ }
        return r;
      }

      /* Quita de un JPG sus metadatos (APP1: EXIF y XMP; APP13: IPTC) sin tocar
         la imagen. null si el archivo no se puede leer como JPG. */
      function sinExif(buf) {
        const v = new DataView(buf);
        if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
        const partes = [buf.slice(0, 2)];
        let o = 2;
        while (o + 4 <= v.byteLength) {
          const m = v.getUint16(o);
          if ((m & 0xFF00) !== 0xFF00) return null;
          if (m === 0xFFDA) { partes.push(buf.slice(o)); return new Blob(partes, { type: 'image/jpeg' }); }
          const fin = o + 2 + v.getUint16(o + 2);
          if (fin > v.byteLength) return null;
          if (m !== 0xFFE1 && m !== 0xFFED) partes.push(buf.slice(o, fin));
          o = fin;
        }
        return null;
      }

      /* Reduce y recodifica (lo que además retira el EXIF de la imagen). */
      function optimizaFoto(file) {
        const o = A.optimiza;
        if (typeof createImageBitmap !== 'function') return Promise.reject(new Error('sin createImageBitmap'));
        return createImageBitmap(file, { imageOrientation: 'from-image' }).then((bmp) => {
          const k = Math.min(1, o.lado / Math.max(bmp.width, bmp.height));
          const c = document.createElement('canvas');
          c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
          const x = c.getContext('2d');
          x.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--blanco').trim();
          x.fillRect(0, 0, c.width, c.height);
          x.drawImage(bmp, 0, 0, c.width, c.height);
          const dims = { ancho: bmp.width, alto: bmp.height };
          if (bmp.close) bmp.close();
          return new Promise((ok, mal) => c.toBlob((b) => (b ? ok({ blob: b, ancho: c.width, alto: c.height, origen: dims }) : mal(new Error('sin blob'))), 'image/jpeg', o.calidad));
        });
      }

      function procesa(f, a, el, c) {
        const lista = archivosPorCampo.get(el);
        a.estado = 'procesando';
        a.promesa = f.arrayBuffer().then(async (buf) => {
          const e = ext(f.name);
          if (!firmaCoincide(buf, e)) throw Object.assign(new Error('firma'), { motivo: M.archRechazoFirma });
          a.sha256_original = await huellaDe(buf);
          if (a.sha256_original && lista.some((x) => x !== a && x.sha256_original === a.sha256_original)) throw Object.assign(new Error('duplicado'), { motivo: M.archRechazoDuplicado });
          const esFoto = A.optimiza.tipos.includes(e);
          /* Lo que recibe el proveedor del borrador tampoco lleva la ubicación sin conservarExif:
             de un JPG se le da la copia sin metadatos, con el mismo nombre y formato. */
          if (esFoto && !c.conservarExif && ['jpg', 'jpeg'].includes(e)) { const limpio = sinExif(buf); if (limpio) a.fuente = new File([limpio], f.name, { type: f.type || 'image/jpeg' }); }
          if (esFoto) {
            const meta = ['jpg', 'jpeg'].includes(e) ? leeExif(buf) : {};
            if (c.conservarExif) { if (meta.fecha) a.fecha_captura = meta.fecha; if (meta.lat !== undefined) { a.lat_captura = meta.lat; a.lon_captura = meta.lon; } }
            const opt = await optimizaFoto(f).catch(() => null);
            if (opt && (opt.origen.ancho < A.imagen.anchoMin || opt.origen.alto < A.imagen.altoMin)) throw Object.assign(new Error('dimension'), { motivo: plantilla(M.archRechazoDimension, { ancho: A.imagen.anchoMin, alto: A.imagen.altoMin }) });
            /* Sin conservarExif (decisión C6), la foto viaja siempre recodificada, sin EXIF ni ubicación,
               aunque así pese más que la original. Si no se pudo recodificar, al JPG se le quitan los
               metadatos; si tampoco se puede, la foto se agrega como está: la Secretaría decidió no
               rechazar una foto por sus metadatos (18 oct 2026). */
            if (opt && (opt.blob.size < f.size || !c.conservarExif)) { a.blob = opt.blob; a.size = opt.blob.size; a.tipo = 'image/jpeg'; a.optimizada = opt.blob.size < f.size; a.dimensiones = `${opt.ancho}x${opt.alto}`; }
            else if (!c.conservarExif) {
              const limpio = ['jpg', 'jpeg'].includes(e) ? sinExif(buf) : null;
              a.blob = limpio || f; a.size = a.blob.size; a.optimizada = false;
            } else { a.blob = f; a.optimizada = false; }
            a.vista = URL.createObjectURL(a.blob);
          } else a.blob = f;
          /* El límite se mide DESPUÉS de optimizar: una foto de 30 MB que queda en 1 MB no se rechaza por lo que pesaba. */
          if (a.size > c.mb * BYTES_POR_MB) throw Object.assign(new Error('peso'), { motivo: plantilla(a.optimizada ? M.archRechazoOptimizada : M.archRechazoPeso, { peso: pesoTxt(a.size), mb: c.mb }) });
          const total = lista.filter((x) => x.estado !== 'error').reduce((s, x) => s + (x.size || 0), 0);
          if (total > c.mbTotal * BYTES_POR_MB) throw Object.assign(new Error('total'), { motivo: plantilla(M.archRechazoTotal, { mb: c.mbTotal }) });
          a.estado = 'listo';
          anuncia(plantilla(M.archAgregado, { nombre: a.nombre }));
        }).catch((err) => {
          a.estado = 'error';
          a.codigo = err.message;
          a.motivo = err.motivo || M.archRechazoProceso;
          a.archivoOriginal = f;
        }).then(() => { delete a.promesa; pinta(el); if (a.estado === 'listo') { limpia(el.dataset.campo); programaBorrador(); } });
      }

      function agrega(archivos, el) {
        const c = configDe(el);
        const lista = archivosPorCampo.get(el);
        const rechazos = [];
        for (const f of archivos) {
          const nombre = saneaNombre(f.name);
          if (lista.filter((x) => x.estado !== 'error').length >= c.max) { rechazos.push({ nombre, motivo: plantilla(c.max === 1 ? M.archRechazoMaxUno : M.archRechazoMax, { max: c.max }) }); continue; }
          if (!c.extensiones.includes(ext(f.name))) { rechazos.push({ nombre, motivo: plantilla(M.archRechazoTipo, { formatos: formatosTxt(c) }) }); continue; }
          if (f.size < A.minBytes) { rechazos.push({ nombre, motivo: M.archRechazoVacio }); continue; }
          const esFoto = A.optimiza.tipos.includes(ext(f.name));
          if (!esFoto && f.size > c.mb * BYTES_POR_MB) { rechazos.push({ nombre, motivo: plantilla(M.archRechazoPeso, { peso: pesoTxt(f.size), mb: c.mb }) }); continue; }
          const a = { nombre, size: f.size, original: f.size, tipo: f.type, fuente: f };
          lista.push(a);
          procesa(f, a, el, c);
        }
        pintaRechazos(el, rechazos);
        pinta(el);
        programaBorrador();
      }

      function pintaRechazos(el, rechazos) {
        const dest = $('[data-rechazos]', el);
        if (!dest) return;
        dest.textContent = '';
        for (const r of rechazos) {
          const d = document.createElement('p');
          d.className = 'arch-rechazo';
          d.setAttribute('role', 'alert');
          const t = document.createElement('strong'); t.textContent = plantilla(M.archRechazoTitulo, { nombre: r.nombre });
          d.append(icono('error', 'icono icono-sm'), t, document.createTextNode(` ${r.motivo}`));
          dest.appendChild(d);
        }
      }

      function pinta(el) {
        const ul = $('.lista-arch', el);
        const lista = archivosPorCampo.get(el);
        ul.textContent = '';
        lista.forEach((a, i) => {
          const li = document.createElement('li');
          li.className = 'arch';
          li.dataset.estado = a.estado || 'espera';
          if (a.vista) { const img = document.createElement('img'); img.className = 'arch-vista'; img.src = a.vista; img.alt = ''; img.width = 96; img.height = 96; li.appendChild(img); }
          else li.appendChild(icono(a.estado === 'procesando' ? 'cargando' : a.estado === 'error' ? 'error' : 'adjunto', `icono arch-icono${a.estado === 'procesando' ? ' icono-giro' : ''}`));
          const cuerpo = document.createElement('div'); cuerpo.className = 'arch-cuerpo';
          const n = document.createElement('span'); n.className = 'arch-nombre'; n.textContent = a.nombre;
          const e = document.createElement('span'); e.className = 'arch-estado';
          e.textContent = a.estado === 'procesando' ? M.archOptimizando : a.estado === 'error' ? `${M.prefijoError} ${a.motivo}` : plantilla(a.optimizada ? M.archOptimizada : M.archPeso, { peso: pesoTxt(a.size) });
          cuerpo.append(n, e);
          li.appendChild(cuerpo);
          /* Reintentar sólo tiene sentido ante un fallo de proceso, no ante un rechazo de regla. */
          if (a.estado === 'error' && a.archivoOriginal && !['firma', 'duplicado', 'dimension', 'peso', 'total'].includes(a.codigo)) {
            const r = document.createElement('button'); r.type = 'button'; r.className = 'btn-enlace'; r.dataset.reintentar = String(i); r.textContent = M.archReintentar; li.appendChild(r);
          }
          const q = document.createElement('button'); q.type = 'button'; q.className = 'btn-icono arch-quitar'; q.dataset.quitar = String(i);
          q.setAttribute('aria-label', plantilla(M.archQuitar, { nombre: a.nombre }));
          q.appendChild(icono('cerrar'));
          li.appendChild(q);
          ul.appendChild(li);
        });
        /* Con el máximo ya cargado, «Elegir archivo» y la cámara se ocultan (data-lleno): a la vista,
           la persona creía que no había subido nada. Vuelven al quitar un archivo. */
        const cont = $('[data-archivos]', el);
        const c = configDe(el);
        const lleno = lista.filter((x) => x.estado !== 'error').length >= c.max;
        if (cont && cont.hasAttribute('data-lleno') !== lleno) {
          const conFoco = cont.contains(document.activeElement) && document.activeElement.matches('.zona-carga,[data-camara]');
          cont.toggleAttribute('data-lleno', lleno);
          /* Lo que se anuncia también se ve (FRM-40): la frase queda bajo la lista mientras siga lleno. */
          let nota = $('.arch-lleno', el);
          if (!nota && lleno) { nota = document.createElement('p'); nota.className = 'arch-lleno'; ul.after(nota); }
          if (nota && !lleno) nota.hidden = true;
          if (lleno) {
            anuncia(plantilla(c.max === 1 ? M.archLlenoUno : M.archLleno, { max: c.max }), { visible: nota });
            if (conFoco) { const q = $$('.arch-quitar', ul).pop(); if (q) q.focus(); }
          }
        }
      }

      for (const cont of $$('[data-archivos]', form)) {
        const el = cont.closest('[data-campo]');
        archivosPorCampo.set(el, []);
        const c = configDe(el);
        const zona = $('.zona-carga', cont);
        const entrada = $('input[type="file"]:not([data-entrada-camara])', cont);
        const camara = $('[data-entrada-camara]', cont);
        const btnCamara = $('[data-camara]', cont);
        const lim = $('[data-limite-texto]', cont);
        entrada.accept = c.extensiones.map((e) => `.${e}`).join(',');
        entrada.multiple = c.max > 1;
        const fmts = formatosTxt(c);
        if (lim) lim.textContent = plantilla(c.max === 1 ? M.archLimiteUno : M.archLimite, { admitidos: fmts.includes(',') ? M.archFormatos : M.archFormato, formatos: fmts, max: c.max, mb: c.mb });
        const etq = $('.etiqueta', el);
        if (etq) { etq.id = etq.id || ctx.idUnico(`et-${el.dataset.campo}`); const zt = $('.zona-carga-texto', zona); if (zt) zt.id = zt.id || ctx.idUnico(`zt-${el.dataset.campo}`); zona.setAttribute('aria-labelledby', `${etq.id}${zt ? ` ${zt.id}` : ''}`); }
        /* La cámara se ofrece sólo donde existe: teléfonos y tabletas con puntero grueso. */
        if (btnCamara && camara && matchMedia('(pointer: coarse)').matches && c.extensiones.some((e) => A.optimiza.tipos.includes(e))) { btnCamara.hidden = false; if (!btnCamara.querySelector('.icono')) btnCamara.prepend(icono('camara')); }

        zona.addEventListener('click', () => entrada.click());
        if (btnCamara && camara) btnCamara.addEventListener('click', () => camara.click());
        entrada.addEventListener('change', () => { agrega(Array.from(entrada.files), el); entrada.value = ''; });
        if (camara) camara.addEventListener('change', () => { agrega(Array.from(camara.files), el); camara.value = ''; });
        zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.setAttribute('data-encima', ''); });
        zona.addEventListener('dragleave', () => zona.removeAttribute('data-encima'));
        zona.addEventListener('drop', (e) => { e.preventDefault(); zona.removeAttribute('data-encima'); agrega(Array.from(e.dataTransfer.files), el); });

        cont.addEventListener('click', (e) => {
          const q = e.target.closest('[data-quitar]');
          if (q) {
            const lista = archivosPorCampo.get(el);
            const [quitado] = lista.splice(Number(q.dataset.quitar), 1);
            if (quitado && quitado.vista) URL.revokeObjectURL(quitado.vista);
            pinta(el);
            anuncia(plantilla(M.archQuitado, { nombre: quitado.nombre }));
            ($('.arch-quitar', cont) || zona).focus();
            programaBorrador();
            return;
          }
          const r = e.target.closest('[data-reintentar]');
          if (r) { const lista = archivosPorCampo.get(el); const a = lista[Number(r.dataset.reintentar)]; if (a && a.archivoOriginal) { delete a.motivo; procesa(a.archivoOriginal, a, el, configDe(el)); pinta(el); } }
        });
      }

      /* Un archivo soltado fuera de la zona haría que el navegador lo abriera y la persona perdiera todo. */
      window.addEventListener('dragover', (e) => { if (!e.target.closest || !e.target.closest('.zona-carga')) e.preventDefault(); });
      window.addEventListener('drop', (e) => { if (!e.target.closest || !e.target.closest('.zona-carga')) e.preventDefault(); });

      /* Archivos en el borrador. El estándar no los guarda en el dispositivo (FRM-43); si la
         página da un proveedor, FormKit.iniciar(form, { borradorArchivos: { guarda(campo, archivos),
         lee(campo), borra(campo) } }), al escribir el borrador se le pasan los archivos listos de
         cada campo, como los eligió la persona (un JPG, sin metadatos si no se pide conservarExif);
         al restaurarlo se le piden (File o promesa de File) y al borrarlo se le avisa.
         El proveedor decide dónde guardarlos (en el servidor, en el almacén del sistema). */
      const camposArchivo = () => $$('[data-archivos]', form).map((c) => c.closest('[data-campo]'));
      const conProveedor = (fn) => { const p = ctx.opciones.borradorArchivos; if (!p) return; for (const el of camposArchivo()) Promise.resolve().then(() => fn(p, el)).catch(() => { /* un proveedor que falla no detiene el formulario */ }); };
      ctx.alBorrador({
        escribe: () => conProveedor((p, el) => p.guarda && p.guarda(el.dataset.campo, (archivosPorCampo.get(el) || []).filter((a) => a.estado === 'listo' && a.fuente).map((a) => a.fuente))),
        restaura: () => conProveedor((p, el) => p.lee && Promise.resolve(p.lee(el.dataset.campo)).then((archivos) => { if (archivos && archivos.length) agrega(Array.from(archivos), el); })),
        borra: () => conProveedor((p, el) => p.borra && p.borra(el.dataset.campo))
      });

      FormKit.archivos = { de: (el) => archivosPorCampo.get(el) || [], agrega };
    }
  });
}());
