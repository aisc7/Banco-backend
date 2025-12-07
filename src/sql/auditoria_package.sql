-- Auditoria package placeholder (Oracle PL/SQL)
-- Create spec and body when implementing audit logic

CREATE OR REPLACE PACKAGE auditoria_pkg AS
  PROCEDURE registrar_evento(
    p_usuario IN VARCHAR2,
    p_ip IN VARCHAR2,
    p_dominio IN VARCHAR2,
    p_tabla IN VARCHAR2,
    p_operacion IN VARCHAR2,
    p_descripcion IN VARCHAR2
  );
END auditoria_pkg;
/

CREATE OR REPLACE PACKAGE BODY auditoria_pkg AS
  PROCEDURE registrar_evento(
    p_usuario IN VARCHAR2,
    p_ip IN VARCHAR2,
    p_dominio IN VARCHAR2,
    p_tabla IN VARCHAR2,
    p_operacion IN VARCHAR2,
    p_descripcion IN VARCHAR2
  ) IS
  BEGIN
    -- TODO: Insert into LOG_AUDITORIA
    NULL;
  END registrar_evento;
END auditoria_pkg;
/
