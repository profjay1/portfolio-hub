package com.sahtechlabs.hub.resume.internal;

import java.time.Instant;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

/**
 * One uploaded resume version. The file itself lives on disk under {@code storageKey}; {@code filename} is only the
 * name the admin uploaded, offered back to visitors when they download it.
 */
@Table("resume")
record Resume(@Id @Nullable Long id, String filename, String storageKey, Instant uploadedAt, boolean active) {

    static final int MAX_FILENAME_LENGTH = 255;

    Resume {
        Objects.requireNonNull(filename, "filename");
        Objects.requireNonNull(storageKey, "storageKey");
        Objects.requireNonNull(uploadedAt, "uploadedAt");
        if (filename.isBlank()) {
            throw new IllegalArgumentException("filename must not be blank");
        }
        if (filename.length() > MAX_FILENAME_LENGTH) {
            throw new IllegalArgumentException("filename must be at most " + MAX_FILENAME_LENGTH + " characters");
        }
        if (storageKey.isBlank()) {
            throw new IllegalArgumentException("storageKey must not be blank");
        }
    }

    /** A new upload is active from the start: uploading is how the admin replaces the public resume. */
    static Resume createActive(String filename, String storageKey, Instant uploadedAt) {
        return new Resume(null, filename, storageKey, uploadedAt, true);
    }

    /** The id of a resume that has been saved; calling this on an unsaved resume is a programming error. */
    long savedId() {
        if (id == null) {
            throw new IllegalStateException("resume has not been saved yet");
        }
        return id;
    }
}
