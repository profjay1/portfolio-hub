package com.sahtechlabs.hub.resume.internal;

import static com.sahtechlabs.hub.BrowserCsrf.csrfToken;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

import com.sahtechlabs.hub.TestcontainersConfiguration;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ResumeApiTests {

    private static final String ADMIN_RESUME = "/api/v1/admin/resume";
    private static final String DOWNLOAD = "/api/v1/resume/download";

    @Autowired
    private MockMvcTester mvc;

    @Autowired
    private ResumeRepository resumes;

    @Autowired
    private ResumeProperties properties;

    @Autowired
    private ResumeStorage storage;

    @BeforeEach
    void startEmpty() throws IOException {
        // Test classes share one context, database and storage directory, so each test starts from a known state.
        resumes.deleteAll();
        try (Stream<Path> files = Files.list(properties.storagePath())) {
            for (Path file : files.toList()) {
                Files.delete(file);
            }
        }
    }

    private static byte[] pdf(String marker) {
        return ("%PDF-1.7\n" + marker + "\n%%EOF").getBytes(StandardCharsets.US_ASCII);
    }

    private static MockMultipartFile file(String filename, String contentType, byte[] content) {
        return new MockMultipartFile("file", filename, contentType, content);
    }

    /** Uploads as whoever the test's security context says (anonymous unless annotated). */
    private MvcTestResult upload(MockMultipartFile file) {
        return mvc.post().uri(ADMIN_RESUME).multipart().file(file).with(csrfToken()).exchange();
    }

    /** For tests that must stay anonymous afterwards, such as a visitor downloading what the admin uploaded. */
    private MvcTestResult uploadAsAdmin(MockMultipartFile file) {
        return mvc.post().uri(ADMIN_RESUME).multipart().file(file).with(csrfToken())
                .with(user("admin").roles("ADMIN"))
                .exchange();
    }

    private long storedFileCount() throws IOException {
        try (Stream<Path> files = Files.list(properties.storagePath())) {
            return files.count();
        }
    }

    // --- Upload and history ---

    @Test
    @WithMockUser(roles = "ADMIN")
    void uploadingAPdfMakesItTheActiveResume() {
        var response = upload(file("Jane Doe CV.pdf", "application/pdf", pdf("v1")));

        assertThat(response).hasStatus(HttpStatus.CREATED);
        assertThat(response).hasHeader("Location", DOWNLOAD);
        var body = assertThat(response).bodyJson();
        body.extractingPath("$.filename").isEqualTo("Jane Doe CV.pdf");
        body.extractingPath("$.active").isEqualTo(true);
        body.extractingPath("$.uploadedAt").isNotNull();
        assertThat(resumes.findByActiveTrue()).get().extracting(Resume::filename).isEqualTo("Jane Doe CV.pdf");
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void aNewUploadReplacesTheActiveResumeAndKeepsTheOldFileOnDisk() {
        upload(file("old.pdf", "application/pdf", pdf("old")));
        Resume old = resumes.findByActiveTrue().orElseThrow();

        upload(file("new.pdf", "application/pdf", pdf("new")));

        assertThat(resumes.findByActiveTrue()).get().extracting(Resume::filename).isEqualTo("new.pdf");
        assertThat(resumes.findById(old.savedId())).get().extracting(Resume::active).isEqualTo(false);
        assertThat(storage.resolve(old.storageKey())).exists().hasBinaryContent(pdf("old"));
        // The public download follows the replacement.
        assertThat(mvc.get().uri(DOWNLOAD).exchange().getResponse().getContentAsByteArray()).isEqualTo(pdf("new"));
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void historyListsEveryUploadNewestFirstWithoutStorageDetails() {
        upload(file("first.pdf", "application/pdf", pdf("1")));
        upload(file("second.pdf", "application/pdf", pdf("2")));

        var body = assertThat(mvc.get().uri(ADMIN_RESUME)).hasStatusOk().bodyJson();

        body.extractingPath("$[*].filename").asArray().containsExactly("second.pdf", "first.pdf");
        body.extractingPath("$[*].active").asArray().containsExactly(true, false);
        body.extractingPath("$[0]").asMap().containsOnlyKeys("id", "filename", "uploadedAt", "active");
    }

    // --- Rejected uploads ---

    @ParameterizedTest
    @ValueSource(strings = {"text/plain", "image/png", "application/octet-stream"})
    @WithMockUser(roles = "ADMIN")
    void rejectsFilesThatAreNotDeclaredAsPdf(String contentType) throws IOException {
        var response = upload(file("cv.pdf", contentType, pdf("x")));

        assertThat(response).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("resume-not-pdf");
        assertThat(response).bodyJson().extractingPath("$.detail").isEqualTo("Only PDF files are accepted.");
        assertThat(resumes.count()).isZero();
        assertThat(storedFileCount()).isZero();
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void rejectsAFileLabelledPdfWhoseContentIsNotPdf() throws IOException {
        var response = upload(file("cv.pdf", "application/pdf", "<html>not a pdf</html>".getBytes()));

        assertThat(response).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("resume-not-pdf");
        assertThat(resumes.count()).isZero();
        assertThat(storedFileCount()).isZero();
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void rejectsAnEmptyFile() {
        var response = upload(file("cv.pdf", "application/pdf", new byte[0]));

        assertThat(response).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("resume-empty");
        assertThat(resumes.count()).isZero();
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void rejectsAFileLargerThanTheLimit() throws IOException {
        byte[] oversized = Arrays.copyOf(pdf("big"), (int) properties.maxSize().toBytes() + 1);

        var response = upload(file("cv.pdf", "application/pdf", oversized));

        assertThat(response).hasStatus(HttpStatus.CONTENT_TOO_LARGE);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("resume-too-large");
        assertThat(response).bodyJson().extractingPath("$.detail").isEqualTo("The file exceeds the 10 MB limit.");
        assertThat(resumes.count()).isZero();
        assertThat(storedFileCount()).isZero();
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void acceptsAFileExactlyAtTheLimit() {
        byte[] atLimit = Arrays.copyOf(pdf("big"), (int) properties.maxSize().toBytes());

        assertThat(upload(file("cv.pdf", "application/pdf", atLimit))).hasStatus(HttpStatus.CREATED);
    }

    // --- Authorization ---

    @Test
    void anonymousCallersCannotUpload() throws IOException {
        var response = upload(file("cv.pdf", "application/pdf", pdf("x")));

        assertThat(response).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("unauthorized");
        assertThat(resumes.count()).isZero();
        assertThat(storedFileCount()).isZero();
    }

    @Test
    void anonymousCallersCannotSeeTheHistory() {
        var response = mvc.get().uri(ADMIN_RESUME).exchange();

        assertThat(response).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("unauthorized");
    }

    @Test
    @WithMockUser(roles = "VISITOR")
    void nonAdminCallersCannotUpload() throws IOException {
        var response = upload(file("cv.pdf", "application/pdf", pdf("x")));

        assertThat(response).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("forbidden");
        assertThat(resumes.count()).isZero();
        assertThat(storedFileCount()).isZero();
    }

    @Test
    @WithMockUser(roles = "VISITOR")
    void nonAdminCallersCannotSeeTheHistory() {
        var response = mvc.get().uri(ADMIN_RESUME).exchange();

        assertThat(response).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("forbidden");
    }

    // --- Public download ---

    @Test
    void downloadIsNotFoundBeforeAnythingIsUploaded() {
        var response = mvc.get().uri(DOWNLOAD).exchange();

        assertThat(response).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("resume-not-found");
    }

    @Test
    void anonymousVisitorsDownloadExactlyTheBytesTheAdminUploaded() throws Exception {
        // Not just a text marker: every byte value, so any re-encoding along the way would show up.
        byte[] content = new byte[64 * 1024];
        for (int i = 0; i < content.length; i++) {
            content[i] = (byte) i;
        }
        System.arraycopy(pdf(""), 0, content, 0, 5);
        assertThat(uploadAsAdmin(file("Jane Doe CV.pdf", "application/pdf", content))).hasStatus(HttpStatus.CREATED);

        var response = mvc.get().uri(DOWNLOAD).exchange();

        assertThat(response).hasStatusOk();
        assertThat(response).hasContentType(MediaType.APPLICATION_PDF);
        assertThat(response).hasHeader("X-Content-Type-Options", "nosniff");
        assertThat(response.getResponse().getHeader("Content-Disposition"))
                .startsWith("attachment;")
                .contains("filename*=UTF-8''Jane%20Doe%20CV.pdf");
        assertThat(response.getResponse().getContentAsByteArray()).isEqualTo(content);
    }
}
