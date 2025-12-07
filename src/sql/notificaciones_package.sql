-- Notificaciones package placeholder (Oracle PL/SQL)
-- Optional package for sending messages/notifications

CREATE OR REPLACE PACKAGE notificaciones_pkg AS
  PROCEDURE enviar_recordatorio(
    p_ci IN NUMBER,
    p_mensaje IN VARCHAR2
  );
END notificaciones_pkg;
/

CREATE OR REPLACE PACKAGE BODY notificaciones_pkg AS
  PROCEDURE enviar_recordatorio(
    p_ci IN NUMBER,
    p_mensaje IN VARCHAR2
  ) IS
  BEGIN
    -- TODO: Simulate sending and/or log notification
    NULL;
  END enviar_recordatorio;
END notificaciones_pkg;
/
