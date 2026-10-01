package com.sahtechlabs.hub.projects.internal;

import java.time.Instant;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

/**
 * A portfolio project. The id is null until the database assigns it on first save. The rules live here as well as on
 * the request DTO, so no code path can store a project the public page should not render.
 */
@Table("project")
record Project(
        @Id @Nullable Long id,
        String title,
        @Nullable String description,
        @Nullable String url,
        @Nullable String imageUrl,
        int displayOrder,
        boolean published,
        Instant createdAt) {

    Project {
        Objects.requireNonNull(title, "title");
        Objects.requireNonNull(createdAt, "createdAt");
        if (title.isBlank()) {
            throw new IllegalArgumentException("title must not be blank");
        }
        if (displayOrder < 0) {
            throw new IllegalArgumentException("displayOrder must not be negative");
        }
        requireHttpUrl("url", url);
        requireHttpUrl("imageUrl", imageUrl);
    }

    static Project create(
            String title,
            @Nullable String description,
            @Nullable String url,
            @Nullable String imageUrl,
            int displayOrder,
            boolean published,
            Instant createdAt) {
        return new Project(null, title, description, url, imageUrl, displayOrder, published, createdAt);
    }

    /** A full replace of the editable fields; identity and creation time never change. */
    Project replaceContent(
            String title,
            @Nullable String description,
            @Nullable String url,
            @Nullable String imageUrl,
            int displayOrder,
            boolean published) {
        return new Project(id, title, description, url, imageUrl, displayOrder, published, createdAt);
    }

    /** The id of a project that has been saved; calling this on an unsaved project is a programming error. */
    long savedId() {
        if (id == null) {
            throw new IllegalStateException("project has not been saved yet");
        }
        return id;
    }

    private static void requireHttpUrl(String field, @Nullable String value) {
        if (value != null && !HttpUrls.isValid(value)) {
            throw new IllegalArgumentException(field + " must be an absolute http(s) URL");
        }
    }
}
