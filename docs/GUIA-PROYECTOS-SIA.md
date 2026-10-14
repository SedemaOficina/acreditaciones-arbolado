# Guía para proyectos que se instalan en el SIA

Cómo empezar un proyecto nuevo pensando desde el primer día en cómo está montado el Sistema de
Información Ambiental (SIA), para que pasarlo al SIA sea copiar un paquete y no rehacerlo. Sale de lo que
se aprendió con el Sistema de Registro de Plantaciones (SRP) y de lo que el equipo del SIA pidió corregir
en otros proyectos antes de instalarlos.

**Cómo usarla.** Al crear el proyecto, copiar este archivo a su carpeta `docs/` y dárselo a quien programe
—persona o IA— como primera instrucción: «Este proyecto se va a instalar en el SIA; sigue
`docs/GUIA-PROYECTOS-SIA.md` desde el principio y contesta su sección 2 antes de escribir código». La
sección 10 es la lista para revisar antes de cada entrega.

Esta guía no lleva direcciones, nombres de equipo, versiones exactas ni detalles de seguridad de la
infraestructura del SIA, y ningún archivo del proyecto debe llevarlos.

## 1. Cómo está montado el SIA

Lo que importa para diseñar:

- **El cifrado termina antes del SIA.** Un intermediario de gobierno recibe el HTTPS del dominio y lo
  reenvía; adentro todo viaja sin cifrar. Ese intermediario no avisa por cabecera que la petición llegó
  cifrada: lo que dependa de eso (la cookie segura, por ejemplo) se decide por configuración.
- **Un servidor web es la puerta.** Sirve los sitios estáticos y reenvía `/api/` al backend. Ahí viven las
  cabeceras de seguridad, la compresión y los límites de velocidad y de subida. Una petición a la API que
  tarda más de un minuto se corta.
- **Un backend central**, Node.js con Express en TypeScript, en un solo proceso empacado en un archivo.
  Cada proyecto es un módulo dentro de él, con su propia conexión a la base.
- **Un servidor de mapas** (GeoServer) publica las capas con los servicios estándar (WMS, WFS, WMTS), con
  una caché de teselas cuya cuota comparten todas las capas.
- **Una base PostgreSQL con PostGIS**, aparte y sin salida a internet. Una sola base; un esquema por
  proyecto; el esquema compartido `territorio` con alcaldías, unidades territoriales, colonias y malla UGA.
  Sólo acepta conexiones cifradas de cuentas de servicio —nunca de personas— desde el servidor de
  aplicaciones.
- **Los recursos son modestos y compartidos.** La memoria y el disco del servidor de aplicaciones los
  comparten todos los módulos: lo que un proyecto gasta lo deja de tener otro.
- **El equipo del SIA instala.** Nadie despliega directo: se entrega un paquete, el SIA lo revisa, lo
  prueba en una copia y lo instala.

## 2. Antes de escribir código

Contestar por escrito, en el `docs/` del proyecto:

1. **Siglas.** Un nombre corto (`jpv`, `irs`, `caec`, `srp`) que será el esquema, la cuenta `<siglas>_api`,
   la ruta y las variables `<SIGLAS>_DB_USER` y `<SIGLAS>_DB_PASS`. Confirmar con el SIA que no choca con
   ningún esquema ni ruta existente.
2. **¿Estático o con backend?** Si sólo muestra datos o mapas, un sitio estático con capas del servidor de
   mapas basta. Backend sólo si hay que escribir datos, guardar archivos o dar acceso con cuentas.
3. **¿Quién entra?**
   - Público: sin cuentas.
   - Personal de SEDEMA: las cuentas del esquema `acceso` del SIA, con un recurso por proyecto.
   - Personas externas (enlaces de alcaldías, empresas), muchas, con altas que da la oficina sin esperar al
     SIA: esquema propio, con un acuerdo por escrito de quién opera las cuentas (altas, bajas,
     restablecimientos). El SIA sólo mantiene el servidor.
4. **¿Qué capas?** Lo que existiría aunque el proyecto no existiera es de `territorio`: se lee de ahí, no se
   copia. Una capa propia sólo si es del programa y sus datos no caben como campo de una capa que ya
   existe; con su origen documentado (de qué catálogo salen sus polígonos).
5. **¿Datos personales?** Qué se guarda y por qué. El aviso de privacidad, o la constancia de que no se
   requiere, se confirma con la Unidad de Transparencia y va en el paquete.
6. **¿Archivos?** Fotografías o documentos van fuera de las carpetas publicadas. Estimar cuánto ocupan al
   año (por ejemplo, 6,000 fotografías de 50 a 100 KB son 300 a 600 MB) y pedir el espacio antes.
7. **¿Volumen?** Ninguna petición puede pasar de un minuto: cargas masivas, altas en lote y envíos grandes,
   por tandas desde el principio.
8. **¿Sin señal?** Si se usa en campo: aplicación instalable (PWA) con service worker, base en el navegador
   y envío cuando vuelve la señal. Escribir en la base del navegador por partes: en el motor de Safari,
   miles de registros de golpe llegaron a tardar minutos (medirlo en un iPhone real).
9. **Repositorio.** De preferencia privado (en GitHub no cuesta; publicar con GitHub Pages desde uno
   privado sí requiere plan de pago). Si es público, aplica con más razón la última sección.

## 3. La base de datos

- **Guiones numerados** en `db/<siglas>/`, que corre quien administra la base:
  1. `01-<siglas>-esquema.sql`: comprueba lo que necesita (PostGIS, `territorio`, `territorio_lectura`),
     crea el esquema y su tabla de versiones, y se detiene sin tocar nada si ya estaba instalado.
  2. Tablas, reglas, índices y comentarios.
  3. Lo que se apoya en `territorio` (funciones de derivación, capas propias).
  4. Último: la cuenta de servicio y sus permisos, con la verificación al final —lo que debe funcionar y lo
     que debe fallar al correrlo como la cuenta—.
  5. `instalar.sql` los corre todos en una sola transacción: o queda todo o no queda nada.
- **Cambios posteriores** como migraciones numeradas, anotadas en la tabla de versiones. Nunca una segunda
  instalación.
- **La cuenta de servicio** con lo mínimo: sólo su esquema; leer y escribir sólo lo que la aplicación edita
  (una que sólo consulta, sólo lee); borrar sólo lo que el sistema permite borrar; la bitácora, sólo leer y
  agregar; `territorio` por el rol de grupo `territorio_lectura`; ningún permiso directo fuera de su esquema;
  un límite de conexiones. Se crea sin contraseña: la pone quien administra, de forma interactiva, y nunca
  queda en un guion ni en el repositorio.
- **La base hace el trabajo** que debe valer siempre, aunque alguien escriba sin pasar por la aplicación:
  disparadores que derivan el territorio de un punto, asignan folios con una tabla contador y escriben una
  bitácora que no se edita ni se borra (por disparador, no sólo por permisos; nada que la recorte).
- **Una sola fuente del modelo de datos.** Un diccionario (por ejemplo, un `esquema.json`) del que se
  generan el SQL y la documentación; los mismos nombres de tabla y de campo en la aplicación y en la base,
  sin capa de traducción.
- **Geografía** en EPSG:4326. Un punto se guarda como latitud y longitud y lleva su índice espacial por
  función, sin campos de más.
- **Para probar**, una base local con una réplica de las tablas de `territorio` que nunca se entrega, y las
  pruebas corren como la cuenta de servicio, no como administración.

## 4. El módulo del backend

- En TypeScript, en `src/modulos/<siglas>/`, con una función `crearRutas<Siglas>(pool)` que el backend
  monta en su ruta. Con su propia conexión, por `<SIGLAS>_DB_USER` y `<SIGLAS>_DB_PASS`. Sin esas variables
  no arranca, y un módulo que no arranca detiene el backend entero: por eso se instalan antes que el código.
- Sin dependencias que el backend del SIA no use ya.
- Errores con la forma del SIA, `{ codigo, mensaje }`, en español para la persona; lo interno queda en el
  registro del servidor, nunca en la respuesta.
- Express valida la forma de lo que llega y pone lo que el cliente no decide (quién, cuándo, el folio). Las
  reglas que deben valer siempre, en la base (sección 3).
- Cada petición termina en menos de un minuto y cabe en el límite de subida del servidor web. Nada que
  reserve cientos de MB de memoria por petición.
- `npm run typecheck` sin errores con el módulo integrado.

## 5. Cuentas y sesiones

Si el proyecto tiene cuentas propias:

- **Contraseñas** derivadas con scrypt con los mismos parámetros que `acceso` (N = 2^14, r = 8, p = 1, en
  base64url), nunca en claro. Así, si un día se mudan a `acceso`, se copian renglones sin pedir contraseñas
  nuevas. Un hash más lento parece más seguro, pero con diez accesos simultáneos agota la memoria
  compartida y, en un lote de altas, pasa del minuto.
- **No hay servidor de correo.** Una contraseña no se recupera: se restablece. La administración da una
  temporal de un solo uso, que vence y se cambia en el primer acceso; mientras tanto no se puede hacer otra
  cosa.
- **Entrada:** el mismo 401, con el mismo mensaje y el mismo tiempo, si el correo no existe, la cuenta está
  inactiva o bloqueada, o la contraseña es mala. Si se distinguen, se averigua qué correos tienen cuenta.
- **Bloqueo por cuenta** tras varios intentos fallidos, con el intento anotado en la base, en un solo paso,
  antes de verificar la contraseña: si se lee y se escribe en dos pasos, muchos intentos al mismo tiempo no
  bloquean nunca.
- **Límite por procedencia** que cuenta sólo los intentos fallidos y toma la dirección de la persona
  descartando los saltos conocidos, no la última de `X-Forwarded-For`, que es la del intermediario y es la
  misma para todos. Se usa el módulo común del SIA (`src/comun/procedencia.ts`), no una copia. El servidor
  web pone además su propio límite a la entrada.
- **Sesión:** un testigo al azar de 32 bytes en una cookie sólo HTTP, del mismo sitio, segura por
  configuración y con su ruta acotada a la del proyecto (nunca `/`: viajaría a todas las aplicaciones del
  dominio). En la base sólo su resumen sha256, en una tabla de sesiones propia de la aplicación. Se cierra al
  salir, al vencer, al desactivar la cuenta o su institución y al cambiar o restablecer la contraseña. La
  duración se decide por el uso: quien trabaja en campo necesita más que quien entra a una oficina.
- **La primera cuenta** de administración se da con un guion que sólo imprime el SQL, para que quien
  administra lo revise y lo corra.

## 6. El fragmento del servidor web

El paquete trae el fragmento de configuración del sitio, y el SIA lo integra:

- `absolute_redirect off;` en cada redirección: sin él, la redirección apunta a `http://`.
- Sin `Strict-Transport-Security`: compromete al dominio completo y lo decide el SIA para todo el dominio.
- La entrada de sesión con límite de velocidad, en la zona que el SIA ya tiene para eso.
- La API colgada de la ruta de la aplicación (`/<sitio>/api/`) cuando eso acota mejor la cookie y la
  configuración; si no, `/api/<siglas>`.
- Los archivos con versión en su nombre o en su dirección se guardan en caché por mucho tiempo; la página
  principal y el service worker, no.

## 7. Mapas y capas

- Las capas del SIA se consultan con los servicios estándar del servidor de mapas, y se descargan por WFS.
- La caché de teselas tiene una cuota compartida: no se precargan niveles amplios; si acaso, los niveles
  cercanos de las zonas de trabajo.
- Una capa pesada se prueba en el visor antes de publicarla.
- Una capa propia se entrega en EPSG:4326 con sus conteos de control (cuántos elementos, sumas que se
  puedan recalcular) y su origen.
- Si la aplicación necesita las capas sin señal y las lleva consigo, deben coincidir con `territorio`
  —mismos polígonos, claves y versión— para que lo que se derive en el teléfono y en el servidor sea igual.
  Comprobarlo con una prueba.
- Un mapa base externo necesita su licencia para producción, y su llave nunca va en el repositorio.

## 8. La aplicación

- Estática cuando se pueda. Todo servido desde el propio sitio, sin CDN; una política de seguridad de
  contenido estricta; cada archivo con su versión en la dirección (`?v=`).
- Datos de prueba separados de los reales desde el principio: una bandera que los distinga y una base del
  navegador distinta para cada uno.
- Teléfono primero: áreas de toque de 44 px o más, textos legibles en exterior, accesible con lector de
  pantalla.
- Pruebas automáticas desde el primer día, que prueben lo que ve la persona; en más de un motor de
  navegador (Chromium y WebKit, el de Safari); con fechas movidas, porque una prueba que depende del día
  sólo se descubre el día que falla; y esperando señales de la aplicación, no tiempos fijos.

### Versión en pantalla (regla agregada el 2026-10-12)

Quien usa o revisa el sistema debe saber, sin preguntar, si está frente a una prueba o frente a lo que ya
instaló el SIA.

- **Un solo lugar define la versión:** el archivo `VERSION` en la raíz del proyecto, con una sola línea
  (`0.3`, `1`, `1.2`). De ahí la toman la interfaz, el `?v=` de los archivos, el LEEME y el empaquetado;
  nunca se escribe a mano en otro sitio. Si lo publicado vive en una subcarpeta (`sitio/`), se copia ahí
  `VERSION` al construir; el empaquetado comprueba que ambas digan lo mismo.
- **Mientras no esté instalado en el SIA:** versión de prueba `0.N`. Empieza en `0.1` y sube un número en
  cada publicación de prueba (`0.2`, `0.3`…). Nunca llega a `1` por su cuenta.
- **Al pasar al SIA:** el paquete de la primera instalación lleva versión `1`. Si el SIA devuelve
  observaciones antes de instalarlo, se corrige y se reentrega como `1`, con nueva fecha. Ya instalado,
  cada entrega posterior sube: `1.1`, `1.2`…; un cambio de fondo, `2`.
- **Siempre visible en la interfaz:** un distintivo fijo en todas las pantallas —también la de entrada y
  las que no piden sesión—, en teléfono y escritorio, sin depender de desplazarse. Con el texto completo:
  «Versión de prueba 0.3» o «Versión 1»; nunca sólo «v0.3». La de prueba, con un estilo que no se confunda
  con la instalada; la diferencia va en el texto, no sólo en el color. No tapa botones ni recibe toques.
- **Si no se puede leer la versión**, el distintivo lo dice («Versión sin identificar») en lugar de
  esconderse.
- **Una prueba automática** comprueba que el distintivo aparece y que dice lo mismo que `VERSION`.
- Es distinto de la bandera de datos de prueba (arriba): una versión `1` puede tener datos de prueba en su
  ambiente de ensayo, y una `0.N` nunca debe tener datos reales sin que se diga.

La plantilla `plantillas/version/` trae el distintivo listo (`version-visible.js` y `version-visible.css`,
servidos desde el propio sitio, compatibles con una política de seguridad de contenido estricta):

```html
<link rel="stylesheet" href="version-visible.css?v=0.3">
<script src="version-visible.js?v=0.3" defer></script>
```

Prueba mínima (Playwright):

```js
const version = fs.readFileSync('VERSION', 'utf8').trim();
const texto = version.startsWith('0.') ? `Versión de prueba ${version}` : `Versión ${version}`;
await expect(page.getByTestId('version-sia')).toHaveText(texto);
```

## 9. El paquete que se entrega

- Un ZIP con su `.sha256`, y adentro un manifiesto con la suma de cada archivo de **todas** las carpetas.
- El cambio al backend como diff que aplique limpio sobre la versión vigente de `sia-backend`, más los
  archivos completos. Probado antes en una copia desechable del repositorio: aplica, compila y pasa
  `npm run typecheck`.
- Una guía de instalación en pasos, en este orden: respaldo de la base; guiones SQL; contraseña de la
  cuenta y variables; código; fragmento del servidor web; verificación como la cuenta de servicio. Un
  módulo por despliegue.
- El archivo `VERSION` en la raíz del paquete, en `1` o mayor; el empaquetado se detiene si dice `0.N`.
- Un LEEME con su versión (la misma de `VERSION`), qué hace el proyecto, qué toca del SIA, los conteos de control, las decisiones tomadas, las
  preguntas abiertas, quién opera las cuentas y la constancia del aviso de privacidad.

## 10. Antes de cada entrega

- [ ] Siglas confirmadas con el SIA; esquema, cuenta, ruta y variables con ese nombre.
- [ ] Ninguna capa de `territorio` copiada; las propias, con origen y conteos de control.
- [ ] La cuenta de servicio sin un permiso de más, verificada corriendo como ella.
- [ ] Bitácora que no se edita ni se borra, por disparador.
- [ ] Ninguna petición de más de un minuto; las cargas, por tandas.
- [ ] Contraseñas con los parámetros de `acceso`; un mismo 401 para toda entrada fallida; bloqueo con el
      intento anotado en un solo paso; límite por procedencia con el módulo común del SIA.
- [ ] Cookie con su ruta acotada; sesiones en una tabla propia.
- [ ] Fragmento del servidor web con `absolute_redirect off`, sin `Strict-Transport-Security` y con límite a
      la entrada.
- [ ] Archivos fuera de lo publicado, con su estimado de espacio.
- [ ] Aviso de privacidad o constancia de la Unidad de Transparencia.
- [ ] ZIP, `.sha256` y manifiesto de todas las carpetas; diff que aplica limpio; `typecheck` sin errores.
- [ ] Guía de instalación con el orden de la sección 9.
- [ ] `VERSION` en `1` (primera instalación) o mayor; el distintivo de versión visible en todas las
      pantallas y la prueba que lo compara con `VERSION`, pasando.
- [ ] Ni contraseñas, ni llaves, ni direcciones, ni nombres de equipo, ni versiones exactas de la
      infraestructura en ningún archivo.

## 11. Preguntas para el SIA al empezar

1. ¿Están libres las siglas para el esquema, la cuenta y la ruta?
2. ¿Dónde se publica la aplicación, y su API va bajo `/api/<siglas>` o bajo la ruta de la aplicación?
3. ¿Cuál es el límite de subida para la API?
4. ¿Qué capas tiene `territorio` y en qué versión, y cómo se llaman sus campos de clave y de geometría?
5. Si hay cuentas: ¿`acceso` o esquema propio, y quién las opera?
6. Si hay archivos: ¿cuánto espacio hay para ellos y dónde?

## 12. Lo que no se hace

- Guardar contraseñas en claro, mandarlas por correo o dejarlas en un guion.
- Conectar el sistema a la base con la cuenta de una persona.
- Copiar las capas de `territorio` al esquema del proyecto.
- Una cookie con ruta `/`, o una tabla de sesiones compartida con otra aplicación.
- `Strict-Transport-Security` en el fragmento del proyecto.
- Depender de las cabeceras del intermediario para saber si la petición llegó cifrada.
- Peticiones de más de un minuto.
- Una interfaz sin su versión en pantalla, o una versión `0.N` entregada al SIA.
- Subir al repositorio contraseñas, llaves, direcciones, nombres de equipo o versiones exactas de la
  infraestructura.
