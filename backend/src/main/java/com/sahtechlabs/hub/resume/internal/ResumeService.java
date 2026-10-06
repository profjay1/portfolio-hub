package com.sahtechlabs.hub.resume.internal;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.util.Arrays;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.http.InvalidMediaTypeException;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

/** Use cases for the resume. Controllers stay thin and translate HTTP to and from these calls. */
@Service
class ResumeService {

    /** Every PDF starts with this header; checking it catches files that are only labelled as PDF. */
    private static final byte[] PDF_MAGIC = "%PDF-".getBytes(StandardCharsets.US_ASCII);

    private static final String FALLBACK_FILENAME = "resume.pdf";

    /** A resume file on disk together with its metadata, ready to stream. */
    record Download(Resume resume, Path file) {}

    private final ResumeRepository resumes;
    private final ResumeStorage storage;
    private final TransactionTemplate transaction;
    private final Clock clock;
    private final long maxBytes;

    ResumeService(
            ResumeRepository resumes,
            ResumeStorage storage,
            TransactionTemplate transaction,
            Clock clock,
            ResumeProperties properties) {
        this.resumes = resumes;
        this.storage = storage;
        this.transaction = transaction;
        this.clock = clock;
        this.maxBytes = properties.maxSize().toBytes();
    }

    /**
     * Stores the file, then swaps the active flag in one transaction. The file is written first so no transaction is
     * held open during disk I/O, and so a failure can leave at worst an unreferenced file, never an active row
     * without a file. Previous files are kept on disk as history.
     */
    Resume upload(MultipartFile file) throws IOException {
        validate(file);
        String key;
        try (InputStream content = file.getInputStream()) {
            key = storage.store(content);
        }
        try {
            Resume saved = transaction.execute(status -> {
                resumes.deactivateAll();
                return resumes.save(
                        Resume.createActive(displayName(file.getOriginalFilename()), key, clock.instant()));
            });
            if (saved == null) {
                throw new IllegalStateException("resume transaction returned no result");
            }
            return saved;
        } catch (RuntimeException ex) {
            storage.deleteQuietly(key);
            throw ex;
        }
    }

    List<Resume> history() {
        return resumes.findAllByOrderByUploadedAtDescIdDesc();
    }

    Download activeDownload() {
        Resume active = resumes.findByActiveTrue().orElseThrow(ResumeNotFoundException::new);
        Path file = storage.resolve(active.storageKey());
        if (!Files.isReadable(file)) {
            // The database says a resume exists, so this is an operational fault (lost volume), not a 404.
            throw new IllegalStateException("file for active resume " + active.savedId() + " is missing");
        }
        return new Download(active, file);
    }

    private void validate(MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw InvalidResumeException.empty();
        }
        if (file.getSize() > maxBytes) {
            throw InvalidResumeException.tooLarge(maxBytes / (1024 * 1024));
        }
        if (!isPdfContentType(file.getContentType()) || !startsWithPdfHeader(file)) {
            throw InvalidResumeException.notPdf();
        }
    }

    private static boolean isPdfContentType(@Nullable String contentType) {
        if (contentType == null) {
            return false;
        }
        try {
            return MediaType.APPLICATION_PDF.equalsTypeAndSubtype(MediaType.parseMediaType(contentType));
        } catch (InvalidMediaTypeException ex) {
            return false;
        }
    }

    private static boolean startsWithPdfHeader(MultipartFile file) throws IOException {
        try (InputStream content = file.getInputStream()) {
            return Arrays.equals(content.readNBytes(PDF_MAGIC.length), PDF_MAGIC);
        }
    }

    /**
     * Some browsers send a full client path; keep only the last segment, drop control characters (they would break
     * the Content-Disposition header), and cap the length to what the column holds.
     */
    static String displayName(@Nullable String original) {
        if (original == null) {
            return FALLBACK_FILENAME;
        }
        String name = original.substring(Math.max(original.lastIndexOf('/'), original.lastIndexOf('\\')) + 1)
                .replaceAll("\\p{Cntrl}", "")
                .strip();
        if (name.length() > Resume.MAX_FILENAME_LENGTH) {
            name = name.substring(0, Resume.MAX_FILENAME_LENGTH);
        }
        return name.isEmpty() ? FALLBACK_FILENAME : name;
    }
}
