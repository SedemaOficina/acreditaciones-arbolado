-- INSTALACIÓN COMPLETA DEL ESQUEMA apd, en una sola transacción: o queda todo o no queda nada.
-- Se corre con psql, conectado a la base donde vivirá el esquema, como quien la administra, desde esta
-- carpeta. Requiere PostgreSQL 13 o mayor. No requiere PostGIS ni territorio.
--
--   psql -d <base> -v ON_ERROR_STOP=on -f instalar.sql
--
-- Antes: un respaldo de la base. Después: los pasos de la cuenta, al principio de 05-apd-rol-y-permisos.sql.
-- Se instala como producción: apd.entorno() devuelve «produccion» y la fecha no se puede simular. Sólo
-- una base de pruebas reemplaza esa función (lo hace herramientas/probar-base.sh).

\set ON_ERROR_STOP on
BEGIN;
\ir 01-apd-esquema.sql
\ir 02-apd-tablas.sql
\ir 03-apd-reglas.sql
\ir 04-apd-catalogos.sql
\ir 05-apd-rol-y-permisos.sql
COMMIT;
