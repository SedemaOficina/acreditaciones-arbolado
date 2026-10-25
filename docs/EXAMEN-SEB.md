# Examen en línea con Safe Exam Browser (computadoras del PILARES)

Ajustes del equipo de la Dirección, 25/10/2026: compatibilidad con Safe Exam Browser. El examen se presenta en las
computadoras del salón de cómputo del PILARES Vivero Nezahualcóyotl con Safe Exam Browser (SEB), que encierra la
computadora en la página del examen. Este documento dice qué se revisó de la página, qué se corrigió y qué configuración se
recomienda. Lo marcado **por verificar en la visita técnica** no se pudo confirmar desde aquí: se comprueba en una
computadora del PILARES, con la versión de SEB que tenga instalada.

## 1. Qué se revisó de la página

Se revisaron `sitio/examen.html` y lo que carga (`app/examen.js`, `app/examen-servidor.js`, `app/examen-grupo.js`,
`app/apd.js`, el núcleo y los módulos del estándar, y en la versión de prueba el menú de pruebas) en todo el camino de la
persona: código, «¿Eres tú?», instrucciones, preguntas, revisión, envío y resultado.

| Lo que SEB suele bloquear | Qué hace la página | Resultado |
|---|---|---|
| Ventanas o pestañas nuevas (`target="_blank"`, `window.open`) | Ninguna en el camino del examen. En la versión de prueba, la franja «Pantalla: … · Ver el mapa del trámite» abría el mapa en otra pestaña y en otro sitio | **Corregido**: en `examen.html` la franja ya no lleva ese enlace (`app/pruebas.js`) |
| Enlaces fuera del dominio | La cabecera del examen no enlaza al sitio de la Secretaría (ya era así); no hay otros | Sin cambios |
| Descargas | Ninguna | Sin cambios |
| Impresión (`window.print`) | Ninguna en el examen. Las papeletas con los códigos se imprimen desde «Aplicar el examen», en la computadora de quien aplica, que no usa SEB | Sin cambios |
| Portapapeles | El examen no copia ni pega. La persona escribe su código a mano | Sin cambios |
| Diálogos `alert` / `confirm` / `prompt` | Ninguno. «¿Enviar tus respuestas?» es un diálogo de la página (`FormKit.confirma`, elemento `<dialog>`) | Sin cambios |
| Recarga | Si SEB permite recargar, la recarga vuelve al examen abierto (con lo contestado y lo que haya quedado sin enviar). Si no la permite, no hace falta: la página no depende de recargar | Sin cambios |
| Audio | La lectura en voz alta usa la síntesis de voz del navegador (`speechSynthesis`) | Requiere audio permitido y una voz en español (sección 3) |
| Salir de la ventana | La página cuenta las salidas (`visibilitychange`) para quien aplica; no bloquea nada. Con SEB no debería haber salidas | Sin cambios |

No se detecta SEB por su agente de usuario: nada de la página tiene que comportarse distinto dentro de SEB, y el agente de
usuario se puede imitar. La comprobación de que la persona usa SEB, si se quiere, va en el servidor (sección 4).

El menú de pruebas y las franjas amarillas sólo existen en la versión de prueba; al pasar al SIA se quitan. En la versión
de prueba, además, el «servidor» del examen vive en el navegador (`app/examen-servidor.js`): la pantalla de quien aplica y
la del examen sólo se ven entre pestañas del mismo navegador. Por eso la prueba en el PILARES con varias computadoras se
hace con la versión del SIA; con la de prueba sólo se revisa la página en una computadora.

## 2. Configuración recomendada

Los nombres entre comillas invertidas son claves del archivo de configuración de SEB tal como aparecen en el ejemplo de la
documentación oficial (`safeexambrowser.org/developer/seb-config-key.html`). Los nombres en la herramienta de configuración
de SEB, su versión y su lugar en las pestañas cambian según el sistema operativo: **por verificar en la visita técnica**.

| Qué | Recomendación | Clave de configuración |
|---|---|---|
| Dirección de inicio | La página del examen en el SIA: `https://<dominio del SIA>/<ruta del módulo>/examen.html`. El dominio y la ruta los da el SIA (**por verificar**; en la versión de prueba sería la de GitHub Pages) | `startURL` |
| Navegación permitida | Sólo el dominio del examen; todo lo demás bloqueado, también el contenido incrustado | `URLFilterEnable` = sí, `URLFilterEnableContentFilter` = sí, una regla en `URLFilterRules` que permita `<dominio del SIA>/<ruta del módulo>/` |
| Ventanas nuevas | No permitir ventanas nuevas por enlace ni por código | `newBrowserWindowByLinkPolicy` y `newBrowserWindowByScriptPolicy` en «no permitir» (**por verificar** el valor numérico que corresponde) |
| Salida | Sólo con la contraseña de quien aplica el examen; sin salida sin contraseña | `allowQuit` = sí con `hashedQuitPassword`; `ignoreQuitPassword` = no; `quitURL` vacío |
| Barra de direcciones | Sin barra de direcciones ni de herramientas del navegador | `browserWindowShowURL` = no mostrar, `enableBrowserWindowToolbar` = no (**por verificar** cómo se llama en la versión instalada) |
| Recarga | Permitida, sin advertencia: si la página se traba, quien aplica la recarga y la persona sigue | `browserWindowAllowReload` = sí, `showReloadButton` = sí, `showReloadWarning` = no |
| Descargas e impresión | No se usan: desactivadas | `allowDownUploads` = no; impresión desactivada (**por verificar** la clave en la versión instalada) |
| Audio | Permitido, para la lectura en voz alta; sin silenciar al iniciar; volumen audible | **Por verificar en la visita técnica**: la opción de audio de SEB (silenciar al iniciar, controles de volumen) no aparece en el ejemplo de la documentación consultada; no se inventa su nombre |
| Almacenamiento del navegador | Que SEB conserve el almacenamiento local de la página (`localStorage`) entre un cierre inesperado y el siguiente inicio en la misma computadora: ahí quedan las respuestas que no alcanzaron a enviarse | **Por verificar en la visita técnica**: si SEB borra los datos del navegador al iniciar o al salir, lo pendiente de un corte de luz se pierde (sigue lo que ya tenía el servidor) |
| Claves de examen | Enviar la Browser Exam Key y la Config Key en cada petición | `sendBrowserExamKey` = sí (sección 4) |

## 3. Lectura en voz alta: qué verificar en las computadoras

La página lee con la síntesis de voz del navegador: busca una voz `es-MX` y, si no hay, cualquier `es-*`. Si no hay
síntesis de voz o ninguna voz en español, los botones no aparecen y quien aplica ve en la fila de la persona «Esta computadora
no puede leer en voz alta». En la visita técnica:

1. **Voz en español instalada** en el sistema operativo de cada computadora (en Windows, una voz de «Español (México)» en
   la configuración de voz; **por verificar** cuál trae cada equipo).
2. **Audífonos** por computadora, para que la lectura de una persona no distraiga a las demás; probar que se oyen.
3. **Que SEB permita el audio** y no lo silencie al iniciar (sección 2). Prueba: abrir el examen en SEB con un código de
   prueba, presionar «Escuchar la pregunta» y comprobar que se oye la pregunta con sus opciones; después «Detener la
   lectura».
4. Que «Aplicar el examen», en la computadora de quien aplica, **no** muestre «Esta computadora no puede leer en voz alta»
   para esa computadora.

## 4. Pendiente del SIA: validar en el servidor que el examen se presenta con SEB

Con `sendBrowserExamKey`, SEB agrega a cada petición un encabezado con un resumen de la Config Key
(`X-SafeExamBrowser-ConfigKeyHash`) y otro con el de la Browser Exam Key (**por verificar** su nombre exacto en la
especificación de la Browser Exam Key). Cada uno es el SHA-256, en hexadecimal, de la dirección completa de la petición (sin
el fragmento `#…`) seguida de la clave. En SEB 3.x la página también los tiene en
`SafeExamBrowser.security.browserExamKey` y `SafeExamBrowser.security.configKey`.

Lo que haría la API del módulo en la etapa 3 (pendiente del SIA, no construido):

- guardar la Config Key (y, si se usa, la Browser Exam Key) de la configuración aprobada para el PILARES;
- en «entrar con el código» y en cada respuesta y envío, recalcular el resumen con la dirección de la petición y compararlo
  con el encabezado; si no coincide, responder que el examen sólo se presenta en las computadoras del salón;
- registrar los intentos rechazados para quien aplica, como hoy los intentos en otra computadora.

Mientras no se valide en el servidor, cualquier navegador con un código vigente puede abrir el examen; lo que hoy lo impide
es que el código sólo se genera al pasar lista en el salón y se abre en una computadora a la vez.
