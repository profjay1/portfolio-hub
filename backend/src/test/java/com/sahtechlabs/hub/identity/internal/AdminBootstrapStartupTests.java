package com.sahtechlabs.hub.identity.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sahtechlabs.hub.HubApplication;
import com.sahtechlabs.hub.TestcontainersConfiguration;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

/** Starts the real application (random port) against an empty database with one bootstrap variable blanked out. */
@ExtendWith(OutputCaptureExtension.class)
class AdminBootstrapStartupTests {

    @ParameterizedTest
    @CsvSource({"hub.admin.email, HUB_ADMIN_EMAIL", "hub.admin.password, HUB_ADMIN_PASSWORD"})
    void startupFailsAndNamesTheMissingVariable(String property, String variable, CapturedOutput output) {
        var application = new SpringApplicationBuilder(HubApplication.class, TestcontainersConfiguration.class);

        // A command-line argument outranks every other property source, including the test credentials.
        assertThatThrownBy(() -> application.run("--server.port=0", "--" + property + "="))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageStartingWith(variable + " is not set.");
        assertThat(output).doesNotContain("integration-test-only-password");
    }
}
