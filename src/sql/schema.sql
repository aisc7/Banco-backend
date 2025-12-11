-- LoanSphere schema (Oracle 21c XE)

-- ==================================
-- TABLA LOG_AUDITORIA
-- ==================================
CREATE TABLE LOG_AUDITORIA (
    id_audit_pk      NUMBER PRIMARY KEY,
    usuario          VARCHAR2(100) NOT NULL,
    ip               VARCHAR2(45),
    dominio          VARCHAR2(150),
    fecha_entrada    DATE NOT NULL,
    fecha_salida     DATE,
    tabla_afectada   VARCHAR2(100),
    operacion        VARCHAR2(50),
    duracion_sesion  NUMBER,
    descripcion      VARCHAR2(300)
);

-- ==================================
-- TABLA LOG_CARGA_CLIENTES
-- ==================================
CREATE TABLE LOG_CARGA_CLIENTES (
    id_log_pk           NUMBER PRIMARY KEY,
    nombre_archivo      VARCHAR2(200) NOT NULL,
    fecha_carga         DATE DEFAULT SYSDATE,
    usuario             VARCHAR2(100) NOT NULL,
    registros_validos     NUMBER DEFAULT 0,
    registros_rechazados  NUMBER DEFAULT 0
);

-- ==================================
-- TABLA CARGA_CLIENTES_DETALLE
-- ==================================
CREATE TABLE CARGA_CLIENTES_DETALLE (
    linea               NUMBER PRIMARY KEY,
    id_log_fk           NUMBER NOT NULL,
    estado VARCHAR2(20) DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE','RECHAZADA','ACEPTADA')),
    descripcion_error  VARCHAR2(300),
    ci                 NUMBER NOT NULL,
    nombre             VARCHAR2(100) NOT NULL,
    telefono           VARCHAR2(20),

    CONSTRAINT fk_log_detalle
        FOREIGN KEY (id_log_fk)
        REFERENCES LOG_CARGA_CLIENTES(id_log_pk)
        ON DELETE CASCADE
);

-- ==================================
-- TABLA PRESTATARIOS
-- ==================================
CREATE TABLE PRESTATARIOS (
    ci NUMBER PRIMARY KEY,
    nombre VARCHAR2(100) NOT NULL,
    apellido VARCHAR2(100) NOT NULL,
    direccion VARCHAR2(200),
    email VARCHAR2(150) UNIQUE,
    foto BLOB,
    estado_cliente VARCHAR2(30) NOT NULL
);

-- ==================================
-- TABLA EMPLEADOS
-- ==================================
CREATE TABLE EMPLEADOS (
    id_empleado NUMBER PRIMARY KEY,
    nombre VARCHAR2(100) NOT NULL,
    apellido VARCHAR2(100) NOT NULL,
    cargo VARCHAR2(200),
    salario NUMBER,
    edad NUMBER
);

-- ==================================
-- TABLA SOLICITUDES_PRESTAMOS
-- ==================================
CREATE TABLE SOLICITUDES_PRESTAMOS (
    id_solicitud_prestamo NUMBER PRIMARY KEY,
    id_prestatario NUMBER NOT NULL,
    id_empleado NUMBER,
    nro_cuotas NUMBER NOT NULL,
    monto NUMBER NOT NULL,
    fecha_envio DATE,
    fecha_respuesta DATE,
    estado VARCHAR2(20) DEFAULT 'PENDIENTE' NOT NULL
        CHECK (estado IN ('PENDIENTE','RECHAZADA','ACEPTADA')),

    CONSTRAINT fk_sp_prestatario
        FOREIGN KEY (id_prestatario) REFERENCES PRESTATARIOS(ci),

    CONSTRAINT fk_sp_empleado
        FOREIGN KEY (id_empleado) REFERENCES EMPLEADOS(id_empleado)
);

-- ==================================
-- SECUENCIA Y TRIGGER PARA SOLICITUDES_PRESTAMOS
-- ==================================
-- Genera el ID de SOLICITUDES_PRESTAMOS automáticamente si no se provee.
-- Ejecutar conectado como el propietario del esquema (p.ej., GERENTE).
CREATE SEQUENCE SEQ_SOLICITUDES_PRESTAMOS START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE;

CREATE OR REPLACE TRIGGER TRG_SOLICITUDES_PRESTAMOS_BI
BEFORE INSERT ON SOLICITUDES_PRESTAMOS
FOR EACH ROW
BEGIN
    IF :NEW.id_solicitud_prestamo IS NULL THEN
        SELECT SEQ_SOLICITUDES_PRESTAMOS.NEXTVAL INTO :NEW.id_solicitud_prestamo FROM dual;
    END IF;
END;
/

-- ==================================
-- TABLA PRESTAMOS
-- ==================================
CREATE TABLE PRESTAMOS (
    id_prestamo NUMBER PRIMARY KEY,
    id_solicitud_prestamo NUMBER NOT NULL,
    id_prestatario NUMBER NOT NULL,
    total_prestado NUMBER NOT NULL,
    nro_cuotas NUMBER NOT NULL,
    interes NUMBER,
    fecha_emision DATE DEFAULT SYSDATE,
    fecha_vencimiento DATE,
    estado VARCHAR2(20) DEFAULT 'PENDIENTE' NOT NULL
        CHECK (estado IN ('PENDIENTE','ACTIVO','CANCELADO','COMPLETADO')),

    CONSTRAINT fk_pr_solicitud
        FOREIGN KEY (id_solicitud_prestamo) REFERENCES SOLICITUDES_PRESTAMOS(id_solicitud_prestamo),

    CONSTRAINT fk_pr_prestatario
        FOREIGN KEY (id_prestatario) REFERENCES PRESTATARIOS(ci)
);

-- ==================================
-- TABLA SOLICITUDES_REFINANCIACION
-- ==================================
CREATE TABLE SOLICITUDES_REFINANCIACION (
    id_solicitud_refinanciacion NUMBER PRIMARY KEY,
    id_prestatario NUMBER NOT NULL,
    id_prestamo NUMBER NOT NULL,
    nro_cuotas NUMBER NOT NULL,
    fecha_realizacion DATE DEFAULT SYSDATE,
    estado VARCHAR2(20) DEFAULT 'PENDIENTE' NOT NULL
        CHECK (estado IN ('PENDIENTE','RECHAZADA','ACEPTADA')),

    CONSTRAINT fk_ref_prestatario
        FOREIGN KEY (id_prestatario) REFERENCES PRESTATARIOS(ci),

    CONSTRAINT fk_ref_prestamo
        FOREIGN KEY (id_prestamo) REFERENCES PRESTAMOS(id_prestamo)
);

-- ==================================
-- TABLA CUOTAS
-- ==================================
CREATE TABLE CUOTAS (
    id_cuota NUMBER PRIMARY KEY,
    id_prestamo NUMBER NOT NULL,
    id_prestatario NUMBER NOT NULL,
    monto NUMBER NOT NULL,
    nro_cuota NUMBER NOT NULL,
    fecha_pago DATE,
    fecha_vencimiento DATE,
    estado VARCHAR2(20) DEFAULT 'PENDIENTE' NOT NULL
        CHECK (estado IN ('PENDIENTE','PAGADA','VENCIDA')),

    CONSTRAINT fk_cuota_prestamo
        FOREIGN KEY (id_prestamo) REFERENCES PRESTAMOS(id_prestamo),

    CONSTRAINT fk_cuota_prestatario
        FOREIGN KEY (id_prestatario) REFERENCES PRESTATARIOS(ci)
);
