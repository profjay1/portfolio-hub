package com.sahtechlabs.hub.resume.internal;

import java.nio.charset.StandardCharsets;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class PublicResumeController {

    private final ResumeService service;

    PublicResumeController(ResumeService service) {
        this.service = service;
    }

    /**
     * Streams the file from disk rather than loading it into memory. Attachment, so browsers save it under the
     * uploaded name; the UTF-8 filename* form keeps non-ASCII names intact.
     */
    @GetMapping("/api/v1/resume/download")
    ResponseEntity<Resource> download() {
        ResumeService.Download download = service.activeDownload();
        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(download.resume().filename(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(new FileSystemResource(download.file()));
    }
}
