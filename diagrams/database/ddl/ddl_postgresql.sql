-- =============================================================================
-- Endpoint Monitor — Database Schema
-- Engine: PostgreSQL 13+
-- =============================================================================

-- -----------------------------------------------------
-- Schema / Search path
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS endpoint_monitor;
SET search_path TO endpoint_monitor;

-- -----------------------------------------------------
-- ENUMs
-- -----------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'endpoint_type') THEN
        CREATE TYPE endpoint_type AS ENUM ('http', 'tcp', 'database', 'dns');
    END IF;
END$$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'endpoint_protocol') THEN
        CREATE TYPE endpoint_protocol AS ENUM ('tcp', 'udp', 'http', 'https', 'icmp');
    END IF;
END$$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'editor', 'readonly');
    END IF;
END$$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'check_status') THEN
        CREATE TYPE check_status AS ENUM ('up', 'down', 'degraded');
    END IF;
END$$;

-- -----------------------------------------------------
-- Table: endpoint
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS endpoint (
  id_endpoint       SERIAL          NOT NULL,
  name              VARCHAR(255)    NOT NULL,
  hostname          VARCHAR(255)    NOT NULL,
  type              endpoint_type   NOT NULL,
  is_active         BOOLEAN         NOT NULL DEFAULT TRUE,
  port              SMALLINT        NOT NULL,
  protocol          endpoint_protocol NULL,
  check_interval_s  INT             NULL DEFAULT 60,
  timeout_s         INT             NULL DEFAULT 5,
  degraded_ms       INT             NULL,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  CONSTRAINT pk_endpoint            PRIMARY KEY (id_endpoint),
  CONSTRAINT uq_endpoint_name       UNIQUE (name),
  CONSTRAINT chk_endpoint_interval  CHECK (check_interval_s IS NULL OR check_interval_s > 0),
  CONSTRAINT chk_endpoint_timeout   CHECK (timeout_s IS NULL OR timeout_s > 0),
  CONSTRAINT chk_endpoint_threshold CHECK (degraded_ms IS NULL OR degraded_ms > 0),
  CONSTRAINT chk_endpoint_port      CHECK (port BETWEEN 1 AND 65535)
);

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_endpoint_updated_at'
    ) THEN
        CREATE TRIGGER trg_endpoint_updated_at
        BEFORE UPDATE ON endpoint
        FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
    END IF;
END$$;

-- -----------------------------------------------------
-- Table: user
-- Nota: "user" é palavra reservada — aspas duplas obrigatórias
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS "user" (
  id_user   SERIAL          NOT NULL,
  name      VARCHAR(255)    NOT NULL,
  password  VARCHAR(255)    NOT NULL,  -- hash bcrypt/argon2id — nunca texto puro
  role      user_role       NOT NULL DEFAULT 'readonly',
  is_active BOOLEAN         NOT NULL DEFAULT TRUE,
  CONSTRAINT pk_user      PRIMARY KEY (id_user),
  CONSTRAINT uq_user_name UNIQUE (name)
);

-- -----------------------------------------------------
-- Table: check_result
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS check_result (
  id_check_result SERIAL          NOT NULL,
  checked_at      TIMESTAMPTZ     NOT NULL,
  status          check_status    NOT NULL,
  latency_ms      INT             NULL,
  status_code     SMALLINT        NULL,
  error_message   TEXT            NULL,
  id_endpoint     INT             NOT NULL,
  CONSTRAINT pk_check_result PRIMARY KEY (id_check_result),
  CONSTRAINT fk_check_result_endpoint
    FOREIGN KEY (id_endpoint)
    REFERENCES endpoint (id_endpoint)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT chk_check_result_latency CHECK (latency_ms IS NULL OR latency_ms >= 0)
);

CREATE INDEX IF NOT EXISTS fk_check_result_endpoint_idx ON check_result (id_endpoint);
