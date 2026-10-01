package com.sahtechlabs.hub;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.PropertySource;
import org.springframework.http.HttpStatus;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Uses its own container, not {@link TestcontainersConfiguration}, because it stops the database. The short pool
 * timeout keeps the "database gone" check from waiting Hikari's default 30 seconds.
 */
@SpringBootTest(properties = "spring.datasource.hikari.connection-timeout=1000")
@AutoConfigureMockMvc
@Import(ReadinessTests.DisposableDatabase.class)
@DirtiesContext
class ReadinessTests {

    @Autowired
    private MockMvcTester mvc;

    @Autowired
    private PostgreSQLContainer database;

    @Test
    void readinessGoesDownWhenTheDatabaseBecomesUnreachable() {
        assertThat(mvc.get().uri("/actuator/health/readiness"))
                .hasStatusOk()
                .bodyJson()
                .extractingPath("$.status")
                .isEqualTo("UP");

        database.stop();

        assertThat(mvc.get().uri("/actuator/health/readiness"))
                .hasStatus(HttpStatus.SERVICE_UNAVAILABLE)
                .bodyJson()
                .extractingPath("$.status")
                .isEqualTo("DOWN");
        assertThat(mvc.get().uri("/actuator/health/liveness"))
                .hasStatusOk()
                .bodyJson()
                .extractingPath("$.status")
                .isEqualTo("UP");
    }

    @TestConfiguration(proxyBeanMethods = false)
    @PropertySource("classpath:integration-test.properties")
    static class DisposableDatabase {

        @Bean
        @ServiceConnection
        PostgreSQLContainer disposablePostgres() {
            return new PostgreSQLContainer(DockerImageName.parse("postgres:18-alpine"));
        }
    }
}
