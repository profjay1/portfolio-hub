package com.sahtechlabs.hub.identity.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

import com.sahtechlabs.hub.TestcontainersConfiguration;
import java.time.Clock;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Runs the bootstrap against the real database, starting each test from an empty user table. Afterwards the table is
 * put back as a normal startup leaves it (one admin), because other test classes share this database.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@ExtendWith(OutputCaptureExtension.class)
class AdminBootstrapTests {

    @Autowired
    private UserRepository users;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private Clock clock;

    @Autowired
    private AdminBootstrapProperties configured;

    @Autowired
    private AdminBootstrap bootstrap;

    @BeforeEach
    void startFromAnEmptyUserTable() {
        users.deleteAll();
    }

    @AfterEach
    void restoreTheStateAStartupLeaves() {
        users.deleteAll();
        bootstrap.run();
    }

    @Test
    void createsExactlyOneAdminWithANormalisedEmailAndAVerifiablePassword() {
        bootstrap.run();

        assertThat(users.findAll()).singleElement().satisfies(admin -> {
            assertThat(admin.email()).isEqualTo("admin@example.test");
            assertThat(admin.role()).isEqualTo(Role.ADMIN);
            assertThat(admin.passwordHash()).startsWith("{bcrypt}$2");
            assertThat(passwordEncoder.matches(configured.password(), admin.passwordHash())).isTrue();
            assertThat(admin.createdAt()).isNotNull();
        });
    }

    @Test
    void runningAgainLikeARestartNeverDuplicatesTheAdmin() {
        bootstrap.run();
        User first = users.findAll().getFirst();

        bootstrap.run();

        assertThat(users.findAll()).singleElement().isEqualTo(first);
    }

    @Test
    void aRestartWithDifferentCredentialsNeverOverwritesTheAdmin() {
        bootstrap.run();
        User original = users.findAll().getFirst();

        bootstrapWith("someone-else@example.test", "a-completely-different-password").run();

        assertThat(users.findAll()).singleElement().isEqualTo(original);
        assertThat(passwordEncoder.matches("a-completely-different-password", original.passwordHash())).isFalse();
    }

    @Test
    void onceAnAdminExistsTheVariablesAreNoLongerRequired() {
        bootstrap.run();

        bootstrapWith(null, null).run();

        assertThat(users.count()).isOne();
    }

    @Test
    void refusesAnAdminPasswordShorterThanTheMinimum() {
        assertThatIllegalStateException()
                .isThrownBy(() -> bootstrapWith("admin@example.test", "too-short").run())
                .withMessageStartingWith("HUB_ADMIN_PASSWORD must be at least 12 characters")
                .withMessageNotContaining("too-short");
        assertThat(users.count()).isZero();
    }

    @Test
    void logsTheNewAdminsIdButNeverItsPasswordOrEmail(CapturedOutput output) {
        bootstrap.run();

        assertThat(output)
                .contains("Created the initial admin user (id=" + users.findAll().getFirst().id() + ")")
                .doesNotContain(configured.password())
                .doesNotContainIgnoringCase(configured.email());
    }

    private AdminBootstrap bootstrapWith(String email, String password) {
        return new AdminBootstrap(users, passwordEncoder, clock, new AdminBootstrapProperties(email, password));
    }
}
