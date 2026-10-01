-- Portfolio projects. Visitors see only published rows, in the order the admin chooses.
CREATE TABLE project (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title         VARCHAR(200)  NOT NULL CHECK (btrim(title) <> ''),
    description   TEXT,
    -- Absolute http(s) URLs only; the application validates the scheme before it gets here.
    url           VARCHAR(2048),
    image_url     VARCHAR(2048),
    display_order INT           NOT NULL CHECK (display_order >= 0),
    -- New projects start as drafts so nothing goes public by accident.
    published     BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ   NOT NULL
);
