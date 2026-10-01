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

/** The signing secret is validated on every start; a missing or weak one must stop the app with a clear reason. */
@ExtendWith(OutputCaptureExtension.class)
class JwtSecretStartupTests {

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
        "''                   | HUB_JWT_SECRET is not set.",
        "too-short-to-be-safe | HUB_JWT_SECRET must be at least 32 bytes (256 bits) long."
    })
    void startupFailsAndExplainsWhatIsWrongWithTheSecret(String secret, String reason, CapturedOutput output) {
        var application = new SpringApplicationBuilder(HubApplication.class, TestcontainersConfiguration.class);

        assertThatThrownBy(() -> application.run("--server.port=0", "--hub.jwt.secret=" + secret));

        assertThat(output).contains(reason);
        if (!secret.isEmpty()) {
            // Regression guard: Bean Validation on this field made Boot print the rejected secret.
            assertThat(output).doesNotContain(secret);
        }
    }
}
