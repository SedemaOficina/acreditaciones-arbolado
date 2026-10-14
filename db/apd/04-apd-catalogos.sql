-- CATÁLOGOS INICIALES DEL ESQUEMA apd. Lo corre quien administra la base, dentro de instalar.sql.
-- Cada valor sale de docs/DECISIONES.md; lo marcado [pendiente] se confirma con la Dirección de
-- Infraestructura Verde antes del primer dato real. Después de instalar, se cambian desde la administración
-- del sistema (con bitácora), no reinstalando.

INSERT INTO apd.parametro (clave, valor, descripcion) VALUES
  ('dias_antes_renovacion', '30',
   'Días naturales antes del vencimiento desde los que se puede renovar (decisión 2026-10-14).'),
  ('meses_despues_renovacion', '12',
   'Meses después del vencimiento durante los que todavía se renueva; pasado ese plazo se tramita como nueva (decisión 2026-10-14).'),
  ('dias_alerta_espera', '31',
   'Días de espera sin grupo a partir de los que la solicitud se marca como prioritaria (decisión 2026-10-14).'),
  ('tamano_maximo_archivo_bytes', '5242880',
   'Tamaño máximo de cada documento cargado: 5 MB (corrección de Liber al mapa, R12, 2026-10-14).');

-- Cupos 10–25 iguales para los cuatro cursos (decisión 2026-10-14).
-- Duración (corrección R31): 5 días la primera vez y 1 día la renovación, en poda y en dictaminador.
-- Asistencia mínima, en días (decisión R33): 4 de 5 en los cursos nuevos y 1 de 1 en renovación.
-- Calificación mínima (corrección R34): 8.0 poda, 9.0 dictaminador.
INSERT INTO apd.curso (tipo_acreditacion, modalidad, nombre, dias_duracion, dias_minimos_asistencia, calificacion_minima, cupo_minimo, cupo_maximo) VALUES
  ('poda',         'nueva',      'Poda y derribo · solicitud nueva',      5, 4, 8.0, 10, 25),
  ('poda',         'renovacion', 'Poda y derribo · renovación',           1, 1, 8.0, 10, 25),
  ('dictaminador', 'nueva',      'Dictaminador técnico · solicitud nueva', 5, 4, 9.0, 10, 25),
  ('dictaminador', 'renovacion', 'Dictaminador técnico · renovación',      1, 1, 9.0, 10, 25);

INSERT INTO apd.requisito (clave, nombre, descripcion, forma, momento) VALUES
  ('identificacion_oficial', 'Identificación oficial',
   'Vigente y con fotografía: credencial para votar, pasaporte, cartilla militar o cédula profesional.', 'documento', 'en_linea'),
  ('curp', 'Clave Única de Registro de Población (CURP)',
   'En formato actualizado.', 'documento', 'en_linea'),
  ('comprobante_domicilio', 'Comprobante de domicilio',
   'De luz, agua, telefonía o internet, con antigüedad no mayor a tres meses. [pendiente] la Dirección debe declarar su uso.', 'documento', 'en_linea'),
  ('constancia_situacion_fiscal', 'Constancia de situación fiscal',
   'Actualizada, a favor de la persona física o moral a la que se emitirá la factura del pago de derechos.', 'documento', 'en_linea'),
  ('pago_derechos', 'Pago de derechos',
   'Se presenta en la cita de cotejo, una vez validada la documentación. Concepto y monto conforme a la Gaceta Oficial [pendiente].', 'documento', 'cotejo'),
  ('poda_anterior', 'Acreditación de poda y derribo a renovar',
   'El sistema la comprueba en su padrón.', 'registro', 'en_linea'),
  ('poda_vigente', 'Acreditación de poda y derribo vigente',
   'El sistema comprueba en su padrón que esté vigente al iniciar la solicitud.', 'registro', 'en_linea'),
  ('dictaminador_anterior', 'Acreditación de dictaminador a renovar',
   'El sistema la comprueba en su padrón.', 'registro', 'en_linea'),
  ('comprobante_estudios', 'Comprobante de estudios',
   'Título, cédula profesional, carta de pasante vigente, constancia de 100 % de créditos o certificado de carrera técnica.', 'documento', 'en_linea'),
  ('curriculum_vitae', 'Currículum vitae',
   'Actualizado, que demuestre la experiencia en manejo de arbolado de acuerdo con el perfil académico.', 'documento', 'en_linea'),
  ('comprobantes_experiencia', 'Comprobantes de experiencia',
   'Constancias laborales, contratos, informes técnicos, actas o registros que acrediten la experiencia en manejo de arbolado urbano, en un solo PDF.', 'documento', 'en_linea'),
  ('constancias_capacitacion', 'Constancias de capacitación especializada',
   'Sólo para carrera técnica: constancias o certificaciones de instituciones educativas, colegios profesionales o la Secretaría.', 'documento', 'en_linea');

-- Qué pide cada curso (corrección R46, 2026-10-14): en una renovación sólo es obligatorio lo que cambia en
-- cada trámite (la constancia fiscal para la factura y el pago). Lo demás se carga sólo si la persona lo
-- actualizó: si ya se le acreditó una vez, la Secretaría ya lo revisó. [pendiente] confirmar con Liber que
-- también aplica a identificación, CURP y domicilio, y qué pasa con quien viene de Kobo sin archivos.
INSERT INTO apd.requisito_curso (tipo_acreditacion, modalidad, requisito, orden, obligatorio, nota) VALUES
  ('poda', 'nueva',      'identificacion_oficial',      1, true, ''),
  ('poda', 'nueva',      'curp',                        2, true, ''),
  ('poda', 'nueva',      'comprobante_domicilio',       3, true, ''),
  ('poda', 'nueva',      'constancia_situacion_fiscal', 4, true, ''),
  ('poda', 'nueva',      'pago_derechos',               5, true, ''),
  ('poda', 'renovacion', 'identificacion_oficial',      1, false, 'Sólo si cambió desde tu trámite anterior.'),
  ('poda', 'renovacion', 'curp',                        2, false, 'Sólo si cambió desde tu trámite anterior.'),
  ('poda', 'renovacion', 'comprobante_domicilio',       3, false, 'Sólo si cambió desde tu trámite anterior.'),
  ('poda', 'renovacion', 'constancia_situacion_fiscal', 4, true,  ''),
  ('poda', 'renovacion', 'pago_derechos',               5, true,  ''),
  ('poda', 'renovacion', 'poda_anterior',               6, true,  ''),
  ('dictaminador', 'nueva',      'identificacion_oficial',      1, true,  ''),
  ('dictaminador', 'nueva',      'curp',                        2, true,  ''),
  ('dictaminador', 'nueva',      'comprobante_domicilio',       3, true,  ''),
  ('dictaminador', 'nueva',      'constancia_situacion_fiscal', 4, true,  ''),
  ('dictaminador', 'nueva',      'pago_derechos',               5, true,  ''),
  ('dictaminador', 'nueva',      'poda_vigente',                6, true,  ''),
  ('dictaminador', 'nueva',      'comprobante_estudios',        7, true,  ''),
  ('dictaminador', 'nueva',      'curriculum_vitae',            8, true,  ''),
  ('dictaminador', 'nueva',      'comprobantes_experiencia',    9, true,  'Dos años con título, pasantía o 100 % de créditos; cinco con carrera técnica. [pendiente] la regla para pasantes.'),
  ('dictaminador', 'nueva',      'constancias_capacitacion',   10, false, 'Obligatorias sólo con carrera técnica.'),
  ('dictaminador', 'renovacion', 'identificacion_oficial',      1, false, 'Sólo si cambió desde tu trámite anterior.'),
  ('dictaminador', 'renovacion', 'curp',                        2, false, 'Sólo si cambió desde tu trámite anterior.'),
  ('dictaminador', 'renovacion', 'comprobante_domicilio',       3, false, 'Sólo si cambió desde tu trámite anterior.'),
  ('dictaminador', 'renovacion', 'constancia_situacion_fiscal', 4, true,  ''),
  ('dictaminador', 'renovacion', 'pago_derechos',               5, true,  ''),
  ('dictaminador', 'renovacion', 'poda_vigente',                6, true,  ''),
  ('dictaminador', 'renovacion', 'dictaminador_anterior',       7, true,  ''),
  ('dictaminador', 'renovacion', 'comprobante_estudios',        8, false, 'Sólo si actualizaste tus estudios.'),
  ('dictaminador', 'renovacion', 'curriculum_vitae',            9, false, 'Sólo si actualizaste tu experiencia.'),
  ('dictaminador', 'renovacion', 'comprobantes_experiencia',   10, false, 'Sólo si actualizaste tu experiencia.'),
  ('dictaminador', 'renovacion', 'constancias_capacitacion',   11, false, 'Sólo si tienes constancias nuevas.');
