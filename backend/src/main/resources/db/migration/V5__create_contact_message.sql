-- Messages sent through the public contact form, read by the admin in the inbox.
CREATE TABLE contact_message (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name       VARCHAR(200)  NOT NULL CHECK (btrim(name) <> ''),
    -- 254 is the longest address that can actually be delivered (RFC 5321 path limit).
    email      VARCHAR(254)  NOT NULL CHECK (btrim(email) <> ''),
    message    VARCHAR(5000) NOT NULL CHECK (btrim(message) <> ''),
    created_at TIMESTAMPTZ   NOT NULL,
    read       BOOLEAN       NOT NULL DEFAULT FALSE
);

-- The inbox lists newest first.
CREATE INDEX contact_message_created_at_idx ON contact_message (created_at DESC, id DESC);
