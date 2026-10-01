package com.sahtechlabs.hub.projects.internal;

import static com.sahtechlabs.hub.BrowserCsrf.csrfToken;
import static org.assertj.core.api.Assertions.assertThat;

import com.sahtechlabs.hub.TestcontainersConfiguration;
import java.time.Instant;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ProjectsApiTests {

    private static final String ADMIN_PROJECTS = "/api/v1/admin/projects";

    private static final String VALID_BODY = """
            {"title": "Portfolio Hub", "displayOrder": 1}
            """;

    private static final Instant CREATED = Instant.parse("2026-10-01T12:00:00Z");

    @Autowired
    private MockMvcTester mvc;

    @Autowired
    private ProjectRepository projects;

    @BeforeEach
    void startEmpty() {
        // Test classes share one context and database, so each test starts from a known state.
        projects.deleteAll();
    }

    private Project saved(String title, int displayOrder, boolean published) {
        return projects.save(Project.create(title, null, null, null, displayOrder, published, CREATED));
    }

    @Test
    void publicCatalogueListsOnlyPublishedProjectsInDisplayOrder() {
        saved("Third", 3, true);
        saved("Draft", 0, false);
        saved("First", 1, true);
        Project tiedEarlier = saved("Second (saved first)", 2, true);
        saved("Second (saved later)", 2, true);

        var body = assertThat(mvc.get().uri("/api/v1/projects")).hasStatusOk().bodyJson();

        body.extractingPath("$[*].title")
                .asArray()
                .containsExactly("First", "Second (saved first)", "Second (saved later)", "Third");
        body.extractingPath("$[1].id").isEqualTo(tiedEarlier.id().intValue());
    }

    @Test
    void publicCatalogueDoesNotExposeAdminOnlyFields() {
        projects.save(Project.create(
                "Portfolio Hub", "A modular monolith", "https://example.com", "https://example.com/hub.png", 0,
                true, CREATED));

        var body = assertThat(mvc.get().uri("/api/v1/projects")).hasStatusOk().bodyJson();

        body.extractingPath("$[0]")
                .asMap()
                .containsOnlyKeys("id", "title", "description", "url", "imageUrl", "displayOrder");
        body.extractingPath("$[0].imageUrl").isEqualTo("https://example.com/hub.png");
    }

    @Test
    void publicCatalogueIsEmptyWhenNothingIsPublished() {
        saved("Draft", 0, false);

        assertThat(mvc.get().uri("/api/v1/projects")).hasStatusOk().bodyJson().isEqualTo("[]");
    }

    @Test
    void publicCatalogueIsReadOnly() {
        // With a valid CSRF token, so the request reaches the authorization rules rather than the CSRF check.
        assertThat(mvc.post().uri("/api/v1/projects").with(csrfToken())).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    // --- Admin endpoints ---

    /** Every admin operation, sent with a valid CSRF token so the authorization rules are what decide. */
    static Stream<Arguments> adminOperations() {
        return Stream.of(
                Arguments.of(HttpMethod.GET, ADMIN_PROJECTS),
                Arguments.of(HttpMethod.POST, ADMIN_PROJECTS),
                Arguments.of(HttpMethod.PUT, ADMIN_PROJECTS + "/1"),
                Arguments.of(HttpMethod.DELETE, ADMIN_PROJECTS + "/1"));
    }

    private MvcTestResult send(HttpMethod method, String uri) {
        return mvc.method(method).uri(uri).with(csrfToken())
                .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY).exchange();
    }

    @ParameterizedTest
    @MethodSource("adminOperations")
    void anonymousCallersAreRejectedFromAdminOperations(HttpMethod method, String uri) {
        var response = send(method, uri);

        assertThat(response).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("unauthorized");
    }

    @ParameterizedTest
    @MethodSource("adminOperations")
    @WithMockUser(roles = "VISITOR")
    void nonAdminCallersAreRejectedFromAdminOperations(HttpMethod method, String uri) {
        var response = send(method, uri);

        assertThat(response).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("forbidden");
    }

    @ParameterizedTest
    @MethodSource("adminOperations")
    void nothingChangesWhenAnAdminOperationIsRejected(HttpMethod method, String uri) {
        Project existing = saved("Existing", 0, true);

        send(method, uri.replaceFirst("/1$", "/" + existing.id()));

        assertThat(projects.findAll()).containsExactly(existing);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void anAdminCanCreateUpdateAndDeleteAProject() {
        // Create: starts as a draft, so it is not public yet.
        var created = mvc.post().uri(ADMIN_PROJECTS).with(csrfToken()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"title": "Portfolio Hub", "description": "A modular monolith",
                         "url": "https://example.com", "imageUrl": "https://example.com/hub.png",
                         "displayOrder": 2}
                        """)
                .exchange();
        assertThat(created).hasStatus(HttpStatus.CREATED);
        assertThat(created).bodyJson().extractingPath("$.published").isEqualTo(false);
        assertThat(created).bodyJson().extractingPath("$.createdAt").isNotNull();
        long id = projects.findAll().getFirst().savedId();
        assertThat(created).hasHeader("Location", "http://localhost" + ADMIN_PROJECTS + "/" + id);
        assertThat(mvc.get().uri("/api/v1/projects")).bodyJson().isEqualTo("[]");

        // Update: a full replace that publishes it; creation time is kept.
        var updated = mvc.put().uri(ADMIN_PROJECTS + "/" + id).with(csrfToken())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"title": "Portfolio Hub v2", "displayOrder": 0, "published": true}
                        """)
                .exchange();
        assertThat(updated).hasStatusOk();
        assertThat(updated).bodyJson().extractingPath("$.title").isEqualTo("Portfolio Hub v2");
        assertThat(updated).bodyJson().extractingPath("$.url").isNull();
        assertThat(projects.findById(id)).get().satisfies(project -> {
            assertThat(project.published()).isTrue();
            assertThat(project.description()).isNull();
        });
        assertThat(mvc.get().uri("/api/v1/projects")).bodyJson()
                .extractingPath("$[*].title").asArray().containsExactly("Portfolio Hub v2");

        // Delete: gone from the store and from the public catalogue; a second delete finds nothing.
        assertThat(mvc.delete().uri(ADMIN_PROJECTS + "/" + id).with(csrfToken())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(projects.findById(id)).isEmpty();
        assertThat(mvc.get().uri("/api/v1/projects")).bodyJson().isEqualTo("[]");
        assertThat(mvc.delete().uri(ADMIN_PROJECTS + "/" + id).with(csrfToken())).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminListIncludesDraftsInDisplayOrder() {
        saved("Published", 1, true);
        saved("Draft", 0, false);

        var body = assertThat(mvc.get().uri(ADMIN_PROJECTS)).hasStatusOk().bodyJson();

        body.extractingPath("$[*].title").asArray().containsExactly("Draft", "Published");
        body.extractingPath("$[*].published").asArray().containsExactly(false, true);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void rejectsAProjectWithoutTitleOrDisplayOrder() {
        var response = mvc.post().uri(ADMIN_PROJECTS).with(csrfToken()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"title": "  "}
                        """)
                .exchange();

        assertThat(response).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("validation-failed");
        assertThat(response).bodyJson().extractingPath("$.errors[*].field").asArray()
                .containsExactly("displayOrder", "title");
        assertThat(projects.count()).isZero();
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void rejectsLinksThatAreNotAbsoluteHttpUrls() {
        var response = mvc.post().uri(ADMIN_PROJECTS).with(csrfToken()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"title": "Portfolio Hub", "displayOrder": 0,
                         "url": "javascript:alert(1)", "imageUrl": "not a url"}
                        """)
                .exchange();

        assertThat(response).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(response).bodyJson().extractingPath("$.errors[*].field").asArray()
                .containsExactly("imageUrl", "url");
        assertThat(projects.count()).isZero();
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void treatsBlankOptionalFieldsAsAbsent() {
        // An empty form field arrives as "", which should mean "no link", not "invalid link".
        var response = mvc.post().uri(ADMIN_PROJECTS).with(csrfToken()).contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"title": "Portfolio Hub", "displayOrder": 0, "description": " ", "url": "", "imageUrl": ""}
                        """)
                .exchange();

        assertThat(response).hasStatus(HttpStatus.CREATED);
        assertThat(projects.findAll().getFirst()).satisfies(project -> {
            assertThat(project.description()).isNull();
            assertThat(project.url()).isNull();
            assertThat(project.imageUrl()).isNull();
        });
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void updatingOrDeletingAnUnknownProjectIsNotFound() {
        var update = mvc.put().uri(ADMIN_PROJECTS + "/999999").with(csrfToken())
                .contentType(MediaType.APPLICATION_JSON).content(VALID_BODY).exchange();
        var delete = mvc.delete().uri(ADMIN_PROJECTS + "/999999").with(csrfToken()).exchange();

        for (var response : List.of(update, delete)) {
            assertThat(response).hasStatus(HttpStatus.NOT_FOUND)
                    .hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
            assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("project-not-found");
        }
        assertThat(projects.count()).isZero();
    }
}
