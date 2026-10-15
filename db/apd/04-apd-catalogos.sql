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
   'Tamaño máximo de cada documento cargado: 5 MB (corrección de Liber al mapa, R12, 2026-10-14).'),
  ('pago_instrucciones', '[pendiente] Banco, cuenta o CLABE y forma de pago: los define la Secretaría de Administración y Finanzas.',
   'Cómo pagar los derechos; se muestra a la persona con su cita y su referencia (decisión 2026-10-14).'),
  ('entrega_lugar', '[pendiente] Lugar, días y horario de entrega de acreditaciones.',
   'Dónde y cuándo se recoge la acreditación emitida; se muestra a la persona (decisión 2026-10-14).');

-- Cupos 5–25 iguales para los cuatro cursos (corrección R23 y R24, 2026-10-14; antes 10–25).
-- Duración (corrección R31): 5 días la primera vez y 1 día la renovación, en poda y en dictaminador.
-- Asistencia mínima, en días (decisión R33): 4 de 5 en los cursos nuevos y 1 de 1 en renovación.
-- Calificación mínima (segunda corrección R34, 2026-10-14): 7.0 poda, 8.0 dictaminador.
-- Pago de derechos: concepto provisional y monto vacío hasta confirmarlos con la Gaceta Oficial [pendiente].
INSERT INTO apd.curso (tipo_acreditacion, modalidad, nombre, dias_duracion, dias_minimos_asistencia, calificacion_minima, cupo_minimo, cupo_maximo, pago_concepto, pago_monto) VALUES
  ('poda',         'nueva',      'Poda y derribo · solicitud nueva',      5, 4, 7.0, 5, 25, 'Acreditación de poda y derribo de arbolado urbano', NULL),
  ('poda',         'renovacion', 'Poda y derribo · renovación',           1, 1, 7.0, 5, 25, 'Renovación de la acreditación de poda y derribo de arbolado urbano', NULL),
  ('dictaminador', 'nueva',      'Dictaminador técnico · solicitud nueva', 5, 4, 8.0, 5, 25, 'Acreditación de dictaminador técnico de arbolado urbano', NULL),
  ('dictaminador', 'renovacion', 'Dictaminador técnico · renovación',      1, 1, 8.0, 5, 25, 'Renovación de la acreditación de dictaminador técnico de arbolado urbano', NULL);

INSERT INTO apd.requisito (clave, nombre, descripcion, forma, momento) VALUES
  ('identificacion_oficial', 'Identificación oficial',
   'Vigente y con fotografía: credencial para votar, pasaporte, cartilla militar o cédula profesional.', 'documento', 'en_linea'),
  ('curp', 'Clave Única de Registro de Población (CURP)',
   'En formato actualizado.', 'documento', 'en_linea'),
  ('comprobante_domicilio', 'Comprobante de domicilio',
   'De luz, agua, telefonía o internet, con antigüedad no mayor a tres meses. [pendiente] la Dirección debe declarar su uso.', 'documento', 'en_linea'),
  ('constancia_situacion_fiscal', 'Constancia de situación fiscal',
   'Actualizada, a favor de la persona física o moral a la que la Secretaría emitirá la factura del pago de derechos.', 'documento', 'en_linea'),
  ('factura_pago', 'Factura del pago de derechos',
   'La emite la Secretaría en la cita presencial, después de verificar el pago. Su personal carga el PDF y captura RFC, nombre o razón social y folio fiscal. Sin factura no se asigna curso. Concepto y monto del derecho conforme a la Gaceta Oficial [pendiente].', 'documento', 'cotejo'),
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
   'Constancias o certificaciones de instituciones educativas, colegios profesionales o la Secretaría. Se piden para dictaminador.', 'documento', 'en_linea'),
  ('acuse_entrega', 'Comprobante de recepción firmado',
   'El sistema lo imprime al entregar la credencial; la persona lo firma y el personal carga el PDF escaneado.', 'documento', 'entrega');

-- Fotografía de la credencial (decisión 2026-10-14, Liber): se toma en el lugar al entregar y es la que
-- se imprime en la credencial. Sólo imagen. No sustituye a la fotografía de la cuenta (apd.fotografia).
INSERT INTO apd.requisito (clave, nombre, descripcion, forma, momento, formatos) VALUES
  ('foto_credencial', 'Fotografía de la credencial',
   'La toma el personal de la Secretaría en el lugar de entrega; es la que se imprime en la credencial. [pendiente] fondo, tamaño y encuadre.',
   'documento', 'entrega', ARRAY['image/jpeg', 'image/png']);

-- Qué pide cada curso (corrección R46, confirmada por Liber el 2026-10-14): en una renovación sólo es
-- obligatorio lo que cambia en cada trámite (la constancia fiscal y la factura del pago); se actualizan los
-- documentos vencidos o que ya no estén vigentes, y los de estudios o experiencia que la persona quiera. Lo demás se carga sólo si la persona lo
-- actualizó o si ya no está vigente (R46): si ya se le acreditó una vez, la Secretaría ya lo revisó. [pendiente] confirmar con Liber que
-- también aplica a identificación, CURP y domicilio, y qué pasa con quien viene de Kobo sin archivos.
INSERT INTO apd.requisito_curso (tipo_acreditacion, modalidad, requisito, orden, obligatorio, nota) VALUES
  ('poda', 'nueva',      'identificacion_oficial',      1, true, ''),
  ('poda', 'nueva',      'curp',                        2, true, ''),
  ('poda', 'nueva',      'comprobante_domicilio',       3, true, ''),
  ('poda', 'nueva',      'constancia_situacion_fiscal', 4, true, ''),
  ('poda', 'nueva',      'factura_pago',                5, true, ''),
  ('poda', 'renovacion', 'identificacion_oficial',      1, false, 'Sólo si cambió o ya no está vigente.'),
  ('poda', 'renovacion', 'curp',                        2, false, 'Sólo si cambió o ya no está vigente.'),
  ('poda', 'renovacion', 'comprobante_domicilio',       3, false, 'Sólo si cambió o ya no está vigente.'),
  ('poda', 'renovacion', 'constancia_situacion_fiscal', 4, true,  ''),
  ('poda', 'renovacion', 'factura_pago',                5, true,  ''),
  ('poda', 'renovacion', 'poda_anterior',               6, true,  ''),
  ('dictaminador', 'nueva',      'identificacion_oficial',      1, true,  ''),
  ('dictaminador', 'nueva',      'curp',                        2, true,  ''),
  ('dictaminador', 'nueva',      'comprobante_domicilio',       3, true,  ''),
  ('dictaminador', 'nueva',      'constancia_situacion_fiscal', 4, true,  ''),
  ('dictaminador', 'nueva',      'factura_pago',                5, true,  ''),
  ('dictaminador', 'nueva',      'poda_vigente',                6, true,  ''),
  ('dictaminador', 'nueva',      'comprobante_estudios',        7, true,  ''),
  ('dictaminador', 'nueva',      'curriculum_vitae',            8, true,  ''),
  ('dictaminador', 'nueva',      'comprobantes_experiencia',    9, true,  'Dos años con título, pasantía o 100 % de créditos; cinco con carrera técnica. [pendiente] la regla para pasantes.'),
  ('dictaminador', 'nueva',      'constancias_capacitacion',   10, true,  ''),
  ('dictaminador', 'renovacion', 'identificacion_oficial',      1, false, 'Sólo si cambió o ya no está vigente.'),
  ('dictaminador', 'renovacion', 'curp',                        2, false, 'Sólo si cambió o ya no está vigente.'),
  ('dictaminador', 'renovacion', 'comprobante_domicilio',       3, false, 'Sólo si cambió o ya no está vigente.'),
  ('dictaminador', 'renovacion', 'constancia_situacion_fiscal', 4, true,  ''),
  ('dictaminador', 'renovacion', 'factura_pago',                5, true,  ''),
  ('dictaminador', 'renovacion', 'poda_vigente',                6, true,  ''),
  ('dictaminador', 'renovacion', 'dictaminador_anterior',       7, true,  ''),
  ('dictaminador', 'renovacion', 'comprobante_estudios',        8, false, 'Sólo si actualizaste tus estudios.'),
  ('dictaminador', 'renovacion', 'curriculum_vitae',            9, false, 'Sólo si actualizaste tu experiencia.'),
  ('dictaminador', 'renovacion', 'comprobantes_experiencia',   10, false, 'Sólo si actualizaste tu experiencia.'),
  ('dictaminador', 'renovacion', 'constancias_capacitacion',   11, false, 'Sólo si tienes constancias nuevas.'),
  -- Al entregar (decisiones 2026-10-14): fotografía para la credencial, tomada en el lugar, y firma de recibido
  ('poda', 'nueva',              'foto_credencial',            89, true,  ''),
  ('poda', 'renovacion',         'foto_credencial',            89, true,  ''),
  ('dictaminador', 'nueva',      'foto_credencial',            89, true,  ''),
  ('dictaminador', 'renovacion', 'foto_credencial',            89, true,  ''),
  ('poda', 'nueva',              'acuse_entrega',              90, true,  ''),
  ('poda', 'renovacion',         'acuse_entrega',              90, true,  ''),
  ('dictaminador', 'nueva',      'acuse_entrega',              90, true,  ''),
  ('dictaminador', 'renovacion', 'acuse_entrega',              90, true,  '');
