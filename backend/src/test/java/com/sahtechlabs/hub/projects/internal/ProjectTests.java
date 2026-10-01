package com.sahtechlabs.hub.projects.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ProjectTests {

    private static final Instant CREATED = Instant.parse("2026-10-01T12:00:00Z");

    private static Project withUrl(String url) {
        return Project.create("Portfolio Hub", null, url, null, 0, false, CREATED);
    }

    @Test
    void aNewProjectHasNoIdUntilSaved() {
        Project project = Project.create("Portfolio Hub", "A modular monolith", null, null, 1, true, CREATED);

        assertThat(project.id()).isNull();
        assertThat(project.createdAt()).isEqualTo(CREATED);
        assertThatIllegalStateException().isThrownBy(project::savedId);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void rejectsABlankTitle(String title) {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> Project.create(title, null, null, null, 0, false, CREATED))
                .withMessageContaining("title");
    }

    @Test
    void rejectsANegativeDisplayOrder() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> Project.create("Portfolio Hub", null, null, null, -1, false, CREATED))
                .withMessageContaining("displayOrder");
    }

    @ParameterizedTest
    @ValueSource(strings = {"https://example.com", "http://example.com/path?q=1", "HTTPS://Example.com"})
    void acceptsAbsoluteHttpUrls(String url) {
        assertThat(withUrl(url).url()).isEqualTo(url);
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "javascript:alert(1)", "ftp://example.com", "not a url", "example.com", "https://", "/relative/path", ""
    })
    void rejectsUrlsThatAreNotAbsoluteHttp(String url) {
        assertThatIllegalArgumentException().isThrownBy(() -> withUrl(url)).withMessageContaining("url");
    }

    @Test
    void appliesTheSameUrlRuleToTheImage() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> Project.create("Portfolio Hub", null, null, "javascript:alert(1)", 0, false, CREATED))
                .withMessageContaining("imageUrl");
    }

    @Test
    void rejectsUrlsLongerThanTheColumnAllows() {
        String tooLong = "https://example.com/" + "a".repeat(HttpUrls.MAX_LENGTH);

        assertThatIllegalArgumentException().isThrownBy(() -> withUrl(tooLong));
    }

    @Test
    void replacingContentKeepsIdentityAndCreationTime() {
        Project saved = new Project(7L, "Old", null, null, null, 3, false, CREATED);

        Project updated = saved.replaceContent("New", "Now published", "https://example.com", null, 1, true);

        assertThat(updated)
                .isEqualTo(new Project(7L, "New", "Now published", "https://example.com", null, 1, true, CREATED));
    }

    @Test
    void replacingContentEnforcesTheSameRules() {
        Project saved = new Project(7L, "Old", null, null, null, 3, false, CREATED);

        assertThatIllegalArgumentException().isThrownBy(() -> saved.replaceContent(" ", null, null, null, 0, false));
    }
}
