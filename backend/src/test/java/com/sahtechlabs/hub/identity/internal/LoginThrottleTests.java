package com.sahtechlabs.hub.identity.internal;

import static com.sahtechlabs.hub.identity.internal.BrowserCsrf.csrfToken;
import static org.assertj.core.api.Assertions.assertThat;

import com.sahtechlabs.hub.MutableClock;
import com.sahtechlabs.hub.TestcontainersConfiguration;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, LoginThrottleTests.ControllableTime.class})
@ExtendWith(OutputCaptureExtension.class)
class LoginThrottleTests {

    private static final String WRONG_PASSWORD = "definitely-not-the-password";

    @Autowired
    private MockMvcTester mvc;

    @Autowired
    private MutableClock clock;

    @Autowired
    private AdminBootstrapProperties admin;

    @BeforeEach
    void startWithEveryEarlierFailureExpired() {
        // The throttle is a singleton shared by this class's tests; a day later nothing from a previous test counts.
        clock.advance(Duration.ofDays(1));
    }

    @Test
    void aSixthAttemptWithTheCorrectPasswordIsStillRefused() {
        for (int attempt = 1; attempt <= 5; attempt++) {
            assertThat(login(admin.email(), WRONG_PASSWORD)).hasStatus(HttpStatus.UNAUTHORIZED);
        }

        MvcTestResult sixth = login(admin.email(), admin.password());

        assertThat(sixth).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(sixth.getResponse().getCookie(SessionCookie.NAME)).isNull();
    }

    @Test
    void theRefusalIsAProblemDetailThatRevealsNothingUseful() throws Exception {
        lockOut(admin.email());

        MvcTestResult refused = login(admin.email(), admin.password());

        assertThat(refused)
                .hasStatus(HttpStatus.TOO_MANY_REQUESTS)
                .hasContentType(MediaType.APPLICATION_PROBLEM_JSON)
                .doesNotContainHeader("Retry-After");
        var body = assertThat(refused).bodyJson();
        body.extractingPath("$.code").isEqualTo("too-many-attempts");
        body.extractingPath("$.status").isEqualTo(429);
        body.extractingPath("$.detail").isEqualTo("Too many failed sign-in attempts. Try again later.");
        body.extractingPath("$.correlationId").isEqualTo("throttle-test");
        assertThat(refused.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .doesNotContainIgnoringCase(admin.email())
                .doesNotContain("remaining", "minutes", "reset");
    }

    @Test
    void duringALockoutRightAndWrongPasswordsGetIdenticalResponses() throws Exception {
        // Otherwise the lockout itself becomes a password oracle: 401 for wrong, something else for right.
        lockOut(admin.email());

        String withWrongPassword = contentOf(login(admin.email(), WRONG_PASSWORD));
        String withRightPassword = contentOf(login(admin.email(), admin.password()));

        assertThat(withRightPassword).isEqualTo(withWrongPassword);
    }

    @Test
    void unknownEmailsAreThrottledIdenticallySoTheResponseRevealsNoAccounts() throws Exception {
        lockOut(admin.email());
        lockOut("nobody-here@example.test");

        String forRealAccount = contentOf(login(admin.email(), admin.password()));
        String forUnknownEmail = contentOf(login("nobody-here@example.test", "any-password-at-all"));

        assertThat(forUnknownEmail).isEqualTo(forRealAccount);
    }

    @Test
    void anotherEmailIsUnaffectedByALockout() {
        lockOut("someone-else@example.test");

        assertThat(login(admin.email(), admin.password())).hasStatusOk();
    }

    @Test
    void emailsDifferingOnlyInCaseShareOneCounter() {
        lockOut(admin.email().toUpperCase());

        assertThat(login(admin.email().toLowerCase(), admin.password())).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void theLockoutEndsFifteenSimulatedMinutesAfterTheFailures() {
        lockOut(admin.email());

        clock.advance(Duration.ofMinutes(15).minusSeconds(1));
        assertThat(login(admin.email(), admin.password())).hasStatus(HttpStatus.TOO_MANY_REQUESTS);

        clock.advance(Duration.ofSeconds(1));
        assertThat(login(admin.email(), admin.password())).hasStatusOk();
    }

    @Test
    void theWindowSlidesRatherThanResettingOnAFixedSchedule() {
        failTimes(admin.email(), 3);
        clock.advance(Duration.ofMinutes(10));
        failTimes(admin.email(), 2);
        assertThat(login(admin.email(), admin.password())).hasStatus(HttpStatus.TOO_MANY_REQUESTS);

        // The first three failures are now 15 minutes old and drop out; only two remain in the window.
        clock.advance(Duration.ofMinutes(5));

        assertThat(login(admin.email(), admin.password())).hasStatusOk();
    }

    @Test
    void retryingDuringALockoutDoesNotExtendIt() {
        lockOut(admin.email());
        clock.advance(Duration.ofMinutes(10));
        for (int retry = 0; retry < 10; retry++) {
            assertThat(login(admin.email(), WRONG_PASSWORD)).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
        }

        clock.advance(Duration.ofMinutes(5));

        assertThat(login(admin.email(), admin.password())).hasStatusOk();
    }

    @Test
    void aSuccessfulLoginClearsEarlierFailures() {
        failTimes(admin.email(), 4);
        assertThat(login(admin.email(), admin.password())).hasStatusOk();

        failTimes(admin.email(), 4);

        assertThat(login(admin.email(), admin.password())).hasStatusOk();
    }

    @Test
    void engagingTheThrottleIsLoggedWithoutTheEmail(CapturedOutput output) {
        lockOut(admin.email());

        assertThat(output)
                .contains("Login throttling engaged for an account after 5 failed attempts")
                .doesNotContainIgnoringCase(admin.email());
    }

    private void lockOut(String email) {
        failTimes(email, LoginThrottle.MAX_FAILURES);
    }

    private void failTimes(String email, int times) {
        for (int attempt = 0; attempt < times; attempt++) {
            assertThat(login(email, WRONG_PASSWORD)).hasStatus(HttpStatus.UNAUTHORIZED);
        }
    }

    private MvcTestResult login(String email, String password) {
        return mvc.post().uri("/api/v1/auth/login")
                .with(csrfToken())
                .header("X-Correlation-Id", "throttle-test")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"email": "%s", "password": "%s"}
                        """.formatted(email, password))
                .exchange();
    }

    private static String contentOf(MvcTestResult result) throws Exception {
        assertThat(result).hasStatus(HttpStatus.TOO_MANY_REQUESTS);
        return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class ControllableTime {

        @Bean
        @Primary
        MutableClock testClock() {
            return new MutableClock(Instant.parse("2026-01-01T00:00:00Z"));
        }
    }
}
