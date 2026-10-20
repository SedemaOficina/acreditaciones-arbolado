# Licencia

© 2026 Secretaría del Medio Ambiente de la Ciudad de México. **Todos los derechos reservados.**

El código y los documentos de este repositorio se publican para consulta mientras el sistema está en su versión de
prueba. Publicarlos no concede permiso para copiarlos, modificarlos ni distribuirlos.

La licencia con la que se publicará el código está por decidir. Se consulta con la Secretaría (pendiente P167; decisión
de Liber del 19/10/2026, auditoría del 19/10/2026, F3-02). Mientras no haya respuesta, rige este aviso.

- **Datos.** Todos los datos del repositorio y de la versión de prueba son ficticios (`datos/ficticios.json`). Ninguna
  persona, CURP, correo, teléfono ni organización es real.
- **Identidad institucional.** El escudo, el logotipo y los nombres del Gobierno de la Ciudad de México y de la
  Secretaría no se reutilizan fuera de los sistemas de la Secretaría, aunque cambie esta licencia.

## Componentes de terceros

Conservan su propia licencia, que viaja junto a sus archivos. La lista con la versión y la huella sha256 de cada archivo
copiado del estándar está en `sitio/vendor/MANIFIESTO.json`, que genera `herramientas/construir-sitio.mjs`.

| Componente | Versión | Licencia | Dónde está | Uso |
|---|---|---|---|---|
| pdf.js (`pdfjs-dist`) | 4.10.38 | Apache-2.0 | `sitio/vendor/pdfjs-dist/LICENSE` | Visor de documentos del personal |
| Fuentes estándar de pdf.js (Foxit) | la de pdf.js | BSD de 3 cláusulas (PDFium) | `sitio/vendor/pdfjs-dist/standard_fonts/LICENSE_FOXIT` | Visor de documentos |
| Fuentes estándar de pdf.js (Liberation) | la de pdf.js | SIL Open Font License 1.1 | `sitio/vendor/pdfjs-dist/standard_fonts/LICENSE_LIBERATION` | Visor de documentos |
| Roboto | la del estándar | SIL Open Font License 1.1 | `sitio/formkit/fuentes/Roboto-OFL.txt` | Texto de las pantallas |
| Cabin | la del estándar | SIL Open Font License 1.1 | `sitio/formkit/fuentes/Cabin-OFL.txt` | Títulos de las pantallas |
| Playwright | 1.63.0 | Apache-2.0 | `package-lock.json` (sólo desarrollo) | Pruebas del sitio |
| axe-core | 4.13.0 | MPL-2.0 | en el estándar, `formularios/vendor/axe-core/` (no se copia aquí) | Pruebas de accesibilidad |

El Estándar de formularios del SIA (`sitio/formkit/`) es una copia sin cambios del repositorio
`SedemaOficina/estandares-sia`, también de la Secretaría. Su licencia es la de ese repositorio.
