package com.sahtechlabs.hub;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.PropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Starts the app the way production does: the {@code prod} profile with the database given only through HUB_DB_*.
 * Uses its own container without {@code @ServiceConnection}, which would supply the connection details and hide a
 * missing mapping.
 */
class ProdDatabaseSettingsTests {

    private static final PostgreSQLContainer database =
            new PostgreSQLContainer(DockerImageName.parse("postgres:18-alpine"));

    @BeforeAll
    static void startDatabase() {
        database.start();
    }

    @AfterAll
    static void stopDatabase() {
        database.stop();
    }

    @Test
    void startsAgainstTheDatabaseNamedOnlyByTheHubDbVariables() {
        try (var context = prodApplication().run(
                "--server.port=0",
                "--HUB_DB_URL=" + database.getJdbcUrl(),
                "--HUB_DB_USER=" + database.getUsername(),
                "--HUB_DB_PASSWORD=" + database.getPassword())) {

            assertThat(context.getBean(Flyway.class).info().pending()).isEmpty();
        }
    }

    @Test
    void startupFailsWhenHubDbUrlIsMissing() {
        // An exported HUB_DB_URL would be picked up from the environment and the app would start against it.
        assertThat(System.getenv("HUB_DB_URL")).as("HUB_DB_URL must not be set where this test runs").isNull();

        var failure = catchThrowable(() -> prodApplication().run(
                "--server.port=0",
                "--HUB_DB_USER=" + database.getUsername(),
                "--HUB_DB_PASSWORD=" + database.getPassword()));

        // Boot leaves the unresolved ${HUB_DB_URL} in place, so the datasource rejects it as a JDBC URL. Checking the
        // root cause keeps this test from passing on an unrelated startup failure.
        assertThat(rootCause(failure))
                .isInstanceOf(IllegalArgumentException.class)
                .message()
                .containsAnyOf("jdbc", "HUB_DB_URL");
    }

    private static Throwable rootCause(Throwable failure) {
        assertThat(failure).as("startup should have failed").isNotNull();
        var cause = failure;
        while (cause.getCause() != null && cause.getCause() != cause) {
            cause = cause.getCause();
        }
        return cause;
    }

    private static SpringApplicationBuilder prodApplication() {
        return new SpringApplicationBuilder(HubApplication.class, IntegrationTestProperties.class).profiles("prod");
    }

    /** The admin bootstrap, JWT and resume settings each start needs, as {@link TestcontainersConfiguration} gives. */
    @TestConfiguration(proxyBeanMethods = false)
    @PropertySource("classpath:integration-test.properties")
    static class IntegrationTestProperties {}
}
