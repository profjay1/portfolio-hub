package com.sahtechlabs.hub;

import static org.assertj.core.api.Assertions.assertThat;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class HubApplicationTests {

    @Autowired
    private Flyway flyway;

    @Test
    void startsAgainstAnEmptyPostgresAndAppliesEveryMigration() {
        var info = flyway.info();

        assertThat(info.pending()).isEmpty();
        assertThat(info.applied())
                .extracting(migration -> migration.getVersion().getVersion())
                .contains("1", "2");
        assertThat(info.applied())
                .extracting(MigrationInfo::getState)
                .allSatisfy(state -> assertThat(state.isApplied() && !state.isFailed()).isTrue());
    }
}
