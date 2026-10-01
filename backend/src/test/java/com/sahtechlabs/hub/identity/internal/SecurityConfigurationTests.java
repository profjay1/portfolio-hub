package com.sahtechlabs.hub.identity.internal;

import static org.assertj.core.api.Assertions.assertThat;

import com.sahtechlabs.hub.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.info.BuildProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class SecurityConfigurationTests {

    @Autowired
    private MockMvcTester mvc;

    @Autowired
    private BuildProperties build;

    @ParameterizedTest
    @ValueSource(strings = {
        "/api/v1/ping", "/actuator/health", "/actuator/health/liveness", "/actuator/health/readiness", "/actuator/info"
    })
    void permitListIsReachableWithoutAuthentication(String path) {
        assertThat(mvc.get().uri(path)).hasStatusOk();
    }

    @Test
    void pingReportsStatusAndTheBuildVersion() {
        var body = assertThat(mvc.get().uri("/api/v1/ping")).hasStatusOk().bodyJson();

        body.extractingPath("$.status").isEqualTo("ok");
        body.extractingPath("$.version").isEqualTo(build.getVersion());
    }

    @Test
    void anonymousIsRejectedFromAdminEndpoints() {
        var response = mvc.get().uri("/api/v1/admin/projects");

        assertThat(response)
                .hasStatus(HttpStatus.UNAUTHORIZED)
                .hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("unauthorized");
        assertThat(response).bodyJson().hasPath("$.correlationId");
    }

    @Test
    @WithMockUser(roles = "VISITOR")
    void wrongRoleIsRejectedFromAdminEndpoints() {
        assertThat(mvc.get().uri("/api/v1/admin/projects"))
                .hasStatus(HttpStatus.FORBIDDEN)
                .hasContentType(MediaType.APPLICATION_PROBLEM_JSON)
                .bodyJson()
                .extractingPath("$.code")
                .isEqualTo("forbidden");
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminPassesTheAdminRule() {
        // No admin endpoint exists yet: reaching the dispatcher (404) proves authorization let the request through.
        assertThat(mvc.get().uri("/api/v1/admin/projects")).hasStatus(HttpStatus.NOT_FOUND);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void pathsNotNamedByAnyRuleAreDeniedEvenToAdmins() {
        assertThat(mvc.get().uri("/api/v1/unlisted")).hasStatus(HttpStatus.FORBIDDEN);
    }

    @Test
    void publicReadsDoNotOpenWritesOnTheSamePath() {
        assertThat(mvc.post().uri("/api/v1/ping")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void responsesCreateNoSessionAndCarrySecurityHeaders() {
        var response = mvc.get().uri("/api/v1/ping").exchange();

        assertThat(response.getResponse().getHeader(HttpHeaders.SET_COOKIE)).isNull();
        assertThat(response.getRequest().getSession(false)).isNull();
        assertThat(response).hasHeader("X-Content-Type-Options", "nosniff");
    }
}
