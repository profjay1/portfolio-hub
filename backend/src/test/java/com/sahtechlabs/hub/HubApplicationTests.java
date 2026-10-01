package com.sahtechlabs.hub;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class HubApplicationTests {

    @Autowired
    private JdbcClient jdbc;

    @Test
    void startsAgainstPostgresAndAppliesTheBaselineMigration() {
        boolean baselineApplied = jdbc.sql("""
                        SELECT success FROM flyway_schema_history WHERE version = '1'
                        """)
                .query(Boolean.class)
                .single();

        assertThat(baselineApplied).isTrue();
    }
}
