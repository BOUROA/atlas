-- FlipyERP Academy · esquema inicial (multiusuario).
--
-- El estado de estudio de cada alumno se guarda como un documento JSON con
-- control de versión (`rev`), con el mismo contrato que el Atlas original
-- (GET/PUT /api/state). Así el motor de Atlas (FSRS, misiones, gamificación)
-- no cambia: solo cambia de quién es el estado.
--
-- Compatible con PostgreSQL real y con pg-mem (tests): sin extensiones ni
-- funciones propias; los ids los genera la aplicación.

CREATE TABLE organizations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- role: admin (gestiona toda la academia), formador (gestiona su
-- organización), alumno.
CREATE TABLE users (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL REFERENCES organizations(id),
  email            TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('admin', 'formador', 'alumno')),
  password_hash    TEXT,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at    TIMESTAMPTZ
);

-- Solo se guarda el hash SHA-256 del token de sesión, nunca el token.
CREATE TABLE sessions (
  token_hash    TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE invitations (
  token_hash       TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL REFERENCES organizations(id),
  email            TEXT NOT NULL,
  name             TEXT,
  role             TEXT NOT NULL CHECK (role IN ('admin', 'formador', 'alumno')),
  itinerary_id     TEXT,
  subject_ids      JSONB NOT NULL,
  created_by       TEXT REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,
  accepted_at      TIMESTAMPTZ
);

-- Itinerario asignado: plantilla (cero/medio/avanzado) o a medida
-- (itinerary_id NULL). subject_ids ya incluye los prerrequisitos.
CREATE TABLE enrollments (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  itinerary_id  TEXT,
  subject_ids   JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    TEXT REFERENCES users(id)
);

CREATE TABLE user_states (
  user_id   TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  rev       INTEGER NOT NULL,
  state     JSONB NOT NULL,
  saved_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Copias de seguridad de las últimas revisiones de cada alumno.
CREATE TABLE user_state_backups (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rev       INTEGER NOT NULL,
  state     JSONB NOT NULL,
  saved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, rev)
);
