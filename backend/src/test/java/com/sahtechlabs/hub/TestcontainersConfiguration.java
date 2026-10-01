package com.sahtechlabs.hub;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.PropertySource;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Real PostgreSQL for integration tests. {@code @ServiceConnection} points the datasource at the container, so
 * tests never need HUB_DB_* variables. Pinned to a major version so CI does not drift with {@code latest}.
 *
 * <p>Every container starts empty, so the admin bootstrap runs on each context start; the property source gives it
 * test credentials. Its low precedence lets a test override them (for example with an empty value).
 */
@TestConfiguration(proxyBeanMethods = false)
@PropertySource("classpath:integration-test.properties")
public class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        return new PostgreSQLContainer(DockerImageName.parse("postgres:18-alpine"));
    }
}
