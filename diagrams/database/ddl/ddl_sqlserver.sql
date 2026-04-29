-- =============================================================================
-- Endpoint Monitor — Database Schema
-- Engine: SQL Server 2019+ (compatível com Azure SQL Database)
-- =============================================================================

-- -----------------------------------------------------
-- Schema
-- -----------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'endpoint_monitor')
    EXEC('CREATE SCHEMA endpoint_monitor');
GO

-- -----------------------------------------------------
-- Table: endpoint
-- -----------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'endpoint_monitor' AND TABLE_NAME = 'endpoint'
)
BEGIN
    CREATE TABLE endpoint_monitor.endpoint (
      id_endpoint       INT             NOT NULL IDENTITY(1,1),
      name              NVARCHAR(255)   NOT NULL,
      hostname          NVARCHAR(255)   NOT NULL,
      type              NVARCHAR(20)    NOT NULL,
      is_active         BIT             NOT NULL DEFAULT 1,
      port              SMALLINT        NOT NULL,
      protocol          NVARCHAR(10)    NULL,
      check_interval_s  INT             NULL DEFAULT 60,
      timeout_s         INT             NULL DEFAULT 5,
      degraded_ms       INT             NULL,
      created_at        DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
      updated_at        DATETIME2(3)    NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT pk_endpoint       PRIMARY KEY (id_endpoint),
      CONSTRAINT uq_endpoint_name  UNIQUE (name),
      CONSTRAINT chk_endpoint_type
          CHECK (type IN ('http', 'tcp', 'database', 'dns')),
      CONSTRAINT chk_endpoint_protocol
          CHECK (protocol IS NULL OR protocol IN ('tcp', 'udp', 'http', 'https', 'icmp')),
      CONSTRAINT chk_endpoint_interval
          CHECK (check_interval_s IS NULL OR check_interval_s > 0),
      CONSTRAINT chk_endpoint_timeout
          CHECK (timeout_s IS NULL OR timeout_s > 0),
      CONSTRAINT chk_endpoint_threshold
          CHECK (degraded_ms IS NULL OR degraded_ms > 0),
      CONSTRAINT chk_endpoint_port
          CHECK (port BETWEEN 1 AND 65535)
    );
END
GO

-- Trigger: updated_at automático
IF NOT EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'trg_endpoint_updated_at')
BEGIN
    EXEC('
    CREATE TRIGGER endpoint_monitor.trg_endpoint_updated_at
    ON endpoint_monitor.endpoint
    AFTER UPDATE
    AS
    BEGIN
        SET NOCOUNT ON;
        UPDATE endpoint_monitor.endpoint
        SET updated_at = SYSUTCDATETIME()
        FROM endpoint_monitor.endpoint e
        INNER JOIN inserted i ON e.id_endpoint = i.id_endpoint;
    END
    ');
END
GO

-- -----------------------------------------------------
-- Table: [user]
-- Nota: USER é palavra reservada — colchetes obrigatórios
-- -----------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'endpoint_monitor' AND TABLE_NAME = 'user'
)
BEGIN
    CREATE TABLE endpoint_monitor.[user] (
      id_user   INT             NOT NULL IDENTITY(1,1),
      name      NVARCHAR(255)   NOT NULL,
      password  NVARCHAR(255)   NOT NULL,  -- hash bcrypt/argon2id — nunca texto puro
      role      NVARCHAR(20)    NOT NULL DEFAULT 'readonly',
      is_active BIT             NOT NULL DEFAULT 1,
      CONSTRAINT pk_user      PRIMARY KEY (id_user),
      CONSTRAINT uq_user_name UNIQUE (name),
      CONSTRAINT chk_user_role
          CHECK (role IN ('admin', 'editor', 'readonly'))
    );
END
GO

-- -----------------------------------------------------
-- Table: check_result
-- -----------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'endpoint_monitor' AND TABLE_NAME = 'check_result'
)
BEGIN
    CREATE TABLE endpoint_monitor.check_result (
      id_check_result INT             NOT NULL IDENTITY(1,1),
      checked_at      DATETIME2(3)    NOT NULL,
      status          NVARCHAR(10)    NOT NULL,
      latency_ms      INT             NULL,
      status_code     SMALLINT        NULL,
      error_message   NVARCHAR(MAX)   NULL,
      id_endpoint     INT             NOT NULL,
      CONSTRAINT pk_check_result PRIMARY KEY (id_check_result),
      CONSTRAINT fk_check_result_endpoint
          FOREIGN KEY (id_endpoint)
          REFERENCES endpoint_monitor.endpoint (id_endpoint)
          ON DELETE CASCADE
          ON UPDATE NO ACTION,
      CONSTRAINT chk_check_result_status
          CHECK (status IN ('up', 'down', 'degraded')),
      CONSTRAINT chk_check_result_latency
          CHECK (latency_ms IS NULL OR latency_ms >= 0)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'fk_check_result_endpoint_idx'
    AND object_id = OBJECT_ID('endpoint_monitor.check_result')
)
    CREATE INDEX fk_check_result_endpoint_idx
        ON endpoint_monitor.check_result (id_endpoint);
GO
