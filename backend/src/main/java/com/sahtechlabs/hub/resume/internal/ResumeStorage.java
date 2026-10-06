package com.sahtechlabs.hub.resume.internal;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Resume files on local disk. Keys are generated here, never taken from the request, and every key is resolved with
 * a containment check, so nothing outside the storage directory can be read or written.
 */
@Component
@EnableConfigurationProperties(ResumeProperties.class)
class ResumeStorage {

    private final Path root;

    ResumeStorage(ResumeProperties properties) {
        this.root = properties.storagePath().toAbsolutePath().normalize();
        try {
            // Fail at startup, not on the first upload, if the directory cannot be created.
            Files.createDirectories(root);
        } catch (IOException ex) {
            throw new UncheckedIOException("Cannot create resume storage directory " + root, ex);
        }
    }

    /** Copies the content to a new file and returns its key. */
    String store(InputStream content) throws IOException {
        String key = UUID.randomUUID() + ".pdf";
        Files.copy(content, resolve(key));
        return key;
    }

    Path resolve(String key) {
        Path path = root.resolve(key).normalize();
        if (!path.getParent().equals(root)) {
            throw new IllegalArgumentException("storage key escapes the storage directory");
        }
        return path;
    }

    void deleteQuietly(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException | RuntimeException ignored) {
            // Best effort: an orphaned file wastes space but is otherwise harmless.
        }
    }
}
