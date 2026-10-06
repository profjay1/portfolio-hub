package com.sahtechlabs.hub.resume.internal;

import java.io.IOException;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Admin-only by the {@code /api/v1/admin/**} rule in the identity module's security configuration. */
@RestController
@RequestMapping("/api/v1/admin/resume")
class AdminResumeController {

    /** The storage key is an implementation detail and stays on the server. */
    record AdminResume(long id, String filename, Instant uploadedAt, boolean active) {

        static AdminResume from(Resume resume) {
            return new AdminResume(resume.savedId(), resume.filename(), resume.uploadedAt(), resume.active());
        }
    }

    private final ResumeService service;

    AdminResumeController(ResumeService service) {
        this.service = service;
    }

    @GetMapping
    List<AdminResume> history() {
        return service.history().stream().map(AdminResume::from).toList();
    }

    /** Created points at the public download, which now serves this upload. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<AdminResume> upload(@RequestPart("file") MultipartFile file) throws IOException {
        Resume resume = service.upload(file);
        return ResponseEntity.created(URI.create("/api/v1/resume/download")).body(AdminResume.from(resume));
    }
}
