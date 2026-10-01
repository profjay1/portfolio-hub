-- Accounts that can sign in to the admin area. Named app_user because "user" is reserved in PostgreSQL.
CREATE TABLE app_user (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- Stored normalised so uniqueness is case-insensitive without a functional index.
    email         VARCHAR(320) NOT NULL UNIQUE CHECK (email = lower(email)),
    -- Encoded by Spring Security's DelegatingPasswordEncoder: "{bcrypt}" prefix + 60-character hash.
    password_hash VARCHAR(100) NOT NULL,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('ADMIN')),
    created_at    TIMESTAMPTZ  NOT NULL
);
