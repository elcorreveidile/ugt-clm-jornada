-- Registro de solo anotación: nadie puede cambiar ni borrar anotaciones ni sellos
-- desde la aplicación. Idempotente: se puede aplicar las veces que haga falta.
--
-- Única excepción: borrar la cuenta completa a petición de su titular (RGPD),
-- dentro de una transacción con:  SET LOCAL jornada.allow_delete = 'on';
--
-- Ojo: quien administre la base de datos podría desactivar este disparador. Por
-- eso la prueba fuerte son la cadena de huellas y los sellos de tiempo, que
-- detectan cualquier cambio aunque se toque la base de datos directamente.

CREATE OR REPLACE FUNCTION jornada_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('jornada.allow_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Registro de solo anotación: no se permite % en %', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS entry_append_only ON "Entry";
CREATE TRIGGER entry_append_only BEFORE UPDATE OR DELETE ON "Entry"
  FOR EACH ROW EXECUTE FUNCTION jornada_append_only();

DROP TRIGGER IF EXISTS entry_no_truncate ON "Entry";
CREATE TRIGGER entry_no_truncate BEFORE TRUNCATE ON "Entry"
  FOR EACH STATEMENT EXECUTE FUNCTION jornada_append_only();

DROP TRIGGER IF EXISTS stamp_append_only ON "Stamp";
CREATE TRIGGER stamp_append_only BEFORE UPDATE OR DELETE ON "Stamp"
  FOR EACH ROW EXECUTE FUNCTION jornada_append_only();

DROP TRIGGER IF EXISTS stamp_no_truncate ON "Stamp";
CREATE TRIGGER stamp_no_truncate BEFORE TRUNCATE ON "Stamp"
  FOR EACH STATEMENT EXECUTE FUNCTION jornada_append_only();
