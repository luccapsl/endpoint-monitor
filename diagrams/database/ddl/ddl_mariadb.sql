-- =============================================================================
-- Endpoint Monitor — Database Schema
-- Engine: MariaDB 10.6+
-- =============================================================================

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema endpoint_monitor
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `endpoint_monitor` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `endpoint_monitor`;

-- -----------------------------------------------------
-- Table: endpoint
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `endpoint` (
  `id_endpoint`       INT NOT NULL AUTO_INCREMENT,
  `name`              VARCHAR(255) NOT NULL,
  `hostname`          VARCHAR(255) NOT NULL,
  `type`              ENUM('http', 'tcp', 'database', 'dns') NOT NULL,
  `is_active`         TINYINT(1) NOT NULL DEFAULT 1,
  `port`              SMALLINT UNSIGNED NOT NULL,
  `protocol`          ENUM('tcp', 'udp', 'http', 'https', 'icmp') NULL,
  `check_interval_s`  INT NULL DEFAULT 60,
  `timeout_s`         INT NULL DEFAULT 5,
  `degraded_ms`       INT NULL,
  `created_at`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id_endpoint`),
  UNIQUE INDEX `name_UNIQUE` (`name` ASC),
  CONSTRAINT `chk_endpoint_interval`  CHECK (`check_interval_s` IS NULL OR `check_interval_s` > 0),
  CONSTRAINT `chk_endpoint_timeout`   CHECK (`timeout_s` IS NULL OR `timeout_s` > 0),
  CONSTRAINT `chk_endpoint_threshold` CHECK (`degraded_ms` IS NULL OR `degraded_ms` > 0),
  CONSTRAINT `chk_endpoint_port`      CHECK (`port` BETWEEN 1 AND 65535)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table: user
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `user` (
  `id_user`   INT NOT NULL AUTO_INCREMENT,
  `name`      VARCHAR(255) NOT NULL,
  `password`  VARCHAR(255) NOT NULL,  -- hash bcrypt/argon2id — nunca texto puro
  `role`      ENUM('admin', 'editor', 'readonly') NOT NULL DEFAULT 'readonly',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id_user`),
  UNIQUE INDEX `name_UNIQUE` (`name` ASC)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------
-- Table: check_result
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `check_result` (
  `id_check_result` INT NOT NULL AUTO_INCREMENT,
  `checked_at`      TIMESTAMP(3) NOT NULL,
  `status`          ENUM('up', 'down', 'degraded') NOT NULL,
  `latency_ms`      INT NULL,
  `status_code`     SMALLINT NULL,
  `error_message`   LONGTEXT NULL,
  `id_endpoint`     INT NOT NULL,
  PRIMARY KEY (`id_check_result`),
  INDEX `fk_check_result_endpoint_idx` (`id_endpoint` ASC),
  CONSTRAINT `fk_check_result_endpoint`
    FOREIGN KEY (`id_endpoint`)
    REFERENCES `endpoint` (`id_endpoint`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `chk_check_result_latency` CHECK (`latency_ms` IS NULL OR `latency_ms` >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
