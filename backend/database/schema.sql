-- ============================================================
--  GreenTasks v3 — Schéma MySQL complet
--  Inclut : users, groups, tasks + colonne feedback
-- ============================================================

CREATE DATABASE IF NOT EXISTS greentasks
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE greentasks;

-- ── Utilisateurs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  nom        VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,
  role       ENUM('student','teacher','admin') NOT NULL DEFAULT 'student',
  group_id   INT          NULL,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Groupes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `groups` (
  id         INT          AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  teacher_id INT          NOT NULL,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Contrainte group_id après création de groups
ALTER TABLE users
  ADD CONSTRAINT fk_users_group
  FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE SET NULL;

-- ── Tâches ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id               INT          AUTO_INCREMENT PRIMARY KEY,
  title            VARCHAR(100) NOT NULL,
  description      TEXT,
  status           ENUM('todo','doing','done') NOT NULL DEFAULT 'todo',
  due_date         DATE         NULL,
  student_id       INT          NOT NULL,
  group_id         INT          NOT NULL,
  -- Feedback enseignant
  feedback         ENUM('approved','partial','rejected') NULL DEFAULT NULL,
  feedback_comment TEXT         NULL,
  feedback_at      DATETIME     NULL,
  created_at       DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id)   REFERENCES `groups`(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Index Green IT : éviter full-scans ───────────────────────
CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_group    ON users(group_id);
CREATE INDEX idx_tasks_student  ON tasks(student_id);
CREATE INDEX idx_tasks_group    ON tasks(group_id);
CREATE INDEX idx_groups_teacher ON `groups`(teacher_id);

