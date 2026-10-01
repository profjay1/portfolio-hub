package com.sahtechlabs.hub;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.endpoint.web.PathMappedEndpoints;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ActuatorExposureTests {

    @Autowired
    private MockMvcTester mvc;

    @Autowired
    private PathMappedEndpoints exposedEndpoints;

    @ParameterizedTest
    @ValueSource(strings = {"/actuator/health", "/actuator/health/liveness", "/actuator/health/readiness"})
    void healthProbesArePublicAndUp(String path) {
        assertThat(mvc.get().uri(path))
                .hasStatusOk()
                .bodyJson()
                .extractingPath("$.status")
                .isEqualTo("UP");
    }

    @Test
    void healthDoesNotRevealComponentDetailsToAnonymousCallers() {
        assertThat(mvc.get().uri("/actuator/health"))
                .bodyJson()
                .hasPath("$.status")
                .doesNotHavePath("$.components");
    }

    @Test
    void infoReportsTheBuildVersionAndCommit() {
        var info = assertThat(mvc.get().uri("/actuator/info")).hasStatusOk().bodyJson();

        info.extractingPath("$.build.version").asString().matches("\\d+\\.\\d+\\.\\d+.*");
        info.extractingPath("$.git.commit.id").asString().isNotBlank();
    }

    @Test
    void onlyHealthAndInfoAreExposedOverHttp() {
        // Checked on the actuator's own registry: with deny-by-default security an unexposed endpoint and a
        // forbidden one both answer 401, so HTTP status alone cannot prove exposure stayed narrow.
        assertThat(exposedEndpoints.getAllPaths())
                .containsExactlyInAnyOrder("/actuator/health", "/actuator/info");
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "/actuator/env", "/actuator/beans", "/actuator/configprops", "/actuator/heapdump",
        "/actuator/threaddump", "/actuator/loggers", "/actuator/metrics", "/actuator/mappings",
        "/actuator/conditions", "/actuator/scheduledtasks", "/actuator/flyway", "/actuator/sbom",
        "/actuator/shutdown"
    })
    void everyOtherEndpointIsRejectedForAnonymousCallers(String path) {
        assertThat(mvc.get().uri(path)).hasStatus(HttpStatus.UNAUTHORIZED);
    }
}
