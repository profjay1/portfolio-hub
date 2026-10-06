-- Uploaded resume versions. Old versions are kept (row and file) as history; visitors download the active one.
CREATE TABLE resume (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- The name the admin uploaded, used only for the download's Content-Disposition.
    filename    VARCHAR(255) NOT NULL CHECK (btrim(filename) <> ''),
    -- Server-generated file name on disk, so user input never becomes part of a filesystem path.
    storage_key VARCHAR(64)  NOT NULL UNIQUE,
    uploaded_at TIMESTAMPTZ  NOT NULL,
    active      BOOLEAN      NOT NULL DEFAULT FALSE
);

-- At most one active resume, guaranteed by the database even if two uploads race.
CREATE UNIQUE INDEX resume_single_active ON resume (active) WHERE active;
