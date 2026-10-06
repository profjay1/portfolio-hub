package com.sahtechlabs.hub.resume.internal;

import jakarta.validation.constraints.NotNull;
import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.unit.DataSize;
import org.springframework.validation.annotation.Validated;

/**
 * {@code storagePath} comes only from {@code HUB_RESUME_STORAGE_PATH} and has no default: guessing a directory would
 * silently put uploads somewhere that is not backed up. Not a secret, so Bean Validation reporting it is fine.
 */
@Validated
@ConfigurationProperties("hub.resume")
record ResumeProperties(@NotNull Path storagePath, @NotNull DataSize maxSize) {}
