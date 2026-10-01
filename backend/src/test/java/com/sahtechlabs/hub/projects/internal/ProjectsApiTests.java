package com.sahtechlabs.hub.projects.internal;

import static com.sahtechlabs.hub.BrowserCsrf.csrfToken;
import static org.assertj.core.api.Assertions.assertThat;

import com.sahtechlabs.hub.TestcontainersConfiguration;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ProjectsApiTests {

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
}
