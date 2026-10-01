package com.sahtechlabs.hub.identity.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static com.sahtechlabs.hub.identity.internal.BrowserCsrf.csrfToken;

import com.sahtechlabs.hub.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AuthenticationFlowTests {

    @Autowired
    private MockMvcTester mvc;

    @Autowired
    private AdminBootstrapProperties admin;

    @Autowired
    private JwtProperties jwtProperties;

    @Autowired
    private TokenService tokens;

    @Autowired
    private UserRepository users;

    @Autowired
    private Clock clock;

    @Test
    void loginSetsAHardenedSessionCookieCarryingTheUsersClaims() {
        MvcTestResult result = login(admin.email(), admin.password());

        assertThat(result).hasStatusOk().bodyJson().extractingPath("$.email").isEqualTo("admin@example.test");
        assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE))
                .startsWith(SessionCookie.NAME + "=")
                .contains("Path=/", "Max-Age=3600", "Secure", "HttpOnly", "SameSite=Strict")
                .doesNotContain("Domain=");

        var claims = NimbusJwtDecoder.withSecretKey(
                        new SecretKeySpec(jwtProperties.secret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"))
                .build()
                .decode(sessionTokenFrom(result));
        assertThat(claims.getSubject()).isEqualTo(String.valueOf(storedAdmin().id()));
        assertThat(claims.getClaimAsString("email")).isEqualTo("admin@example.test");
        assertThat(claims.getClaimAsString("role")).isEqualTo("ADMIN");
        assertThat(claims.getClaimAsString("iss")).isEqualTo(TokenService.ISSUER);
        assertThat(Duration.between(claims.getIssuedAt(), claims.getExpiresAt())).isEqualTo(Duration.ofHours(1));
    }

    @Test
    void wrongPasswordAndUnknownEmailGetIdenticalResponses() throws Exception {
        MvcTestResult wrongPassword = login(admin.email(), "not-the-right-password", "same-correlation-id");
        MvcTestResult unknownEmail = login("nobody@example.test", "not-the-right-password", "same-correlation-id");

        for (MvcTestResult result : new MvcTestResult[] {wrongPassword, unknownEmail}) {
            assertThat(result)
                    .hasStatus(HttpStatus.UNAUTHORIZED)
                    .hasContentType(MediaType.APPLICATION_PROBLEM_JSON)
                    .bodyJson()
                    .extractingPath("$.code")
                    .isEqualTo("invalid-credentials");
            assertThat(result.getResponse().getCookie(SessionCookie.NAME)).isNull();
        }
        assertThat(unknownEmail.getResponse().getContentAsString(StandardCharsets.UTF_8))
                .isEqualTo(wrongPassword.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    @Test
    void meReturnsTheSignedInUser() {
        Cookie session = sessionCookie(sessionTokenFrom(login(admin.email(), admin.password())));

        var body = assertThat(mvc.get().uri("/api/v1/auth/me").cookie(session)).hasStatusOk().bodyJson();
        body.extractingPath("$.email").isEqualTo("admin@example.test");
        body.extractingPath("$.role").isEqualTo("ADMIN");
    }

    @Test
    void meRejectsAMissingCookie() {
        assertUnauthorized(mvc.get().uri("/api/v1/auth/me").exchange());
    }

    @Test
    void meRejectsAGarbageCookie() {
        assertUnauthorized(mvc.get().uri("/api/v1/auth/me").cookie(sessionCookie("not-a-jwt")).exchange());
    }

    @Test
    void meRejectsAnExpiredToken() {
        String expired = new TokenService(jwtProperties, Clock.offset(clock, Duration.ofHours(-2))).issue(storedAdmin());

        assertUnauthorized(mvc.get().uri("/api/v1/auth/me").cookie(sessionCookie(expired)).exchange());
    }

    @Test
    void meRejectsATokenSignedWithAnotherSecret() {
        var otherKey = new JwtProperties("someone-elses-secret-that-is-long-enough", Duration.ofHours(1));
        String forged = new TokenService(otherKey, clock).issue(storedAdmin());

        assertUnauthorized(mvc.get().uri("/api/v1/auth/me").cookie(sessionCookie(forged)).exchange());
    }

    @Test
    void meRejectsATokenWhoseSignatureWasTamperedWith() {
        String token = tokens.issue(storedAdmin());
        int inSignature = token.lastIndexOf('.') + 5;
        char flipped = token.charAt(inSignature) == 'A' ? 'B' : 'A';
        String tampered = token.substring(0, inSignature) + flipped + token.substring(inSignature + 1);

        assertUnauthorized(mvc.get().uri("/api/v1/auth/me").cookie(sessionCookie(tampered)).exchange());
    }

    @Test
    void logoutClearsTheCookieSoTheNextMeIsRejected() {
        Cookie session = sessionCookie(sessionTokenFrom(login(admin.email(), admin.password())));

        MvcTestResult logout = mvc.post().uri("/api/v1/auth/logout").with(csrfToken()).cookie(session).exchange();

        assertThat(logout).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(logout.getResponse().getHeader(HttpHeaders.SET_COOKIE))
                .startsWith(SessionCookie.NAME + "=;")
                .contains("Max-Age=0", "Path=/", "Secure", "HttpOnly", "SameSite=Strict");
        // What the browser holds after obeying that header: an emptied cookie (or none at all).
        Cookie cleared = logout.getResponse().getCookie(SessionCookie.NAME);
        assertUnauthorized(mvc.get().uri("/api/v1/auth/me").cookie(cleared).exchange());
    }

    @Test
    void aTokenCopiedBeforeLogoutStaysValidUntilItExpires() {
        // Documents the stateless trade-off recorded in ADR 0006: logout deletes the cookie, it does not revoke
        // the token. A token captured earlier keeps working until its one-hour expiry.
        Cookie session = sessionCookie(sessionTokenFrom(login(admin.email(), admin.password())));
        mvc.post().uri("/api/v1/auth/logout").with(csrfToken()).cookie(session).exchange();

        assertThat(mvc.get().uri("/api/v1/auth/me").cookie(session)).hasStatusOk();
    }

    @Test
    void aStaleCookieDoesNotBreakPublicEndpointsOrLoggingInAgain() {
        Cookie stale = sessionCookie(
                new TokenService(jwtProperties, Clock.offset(clock, Duration.ofHours(-2))).issue(storedAdmin()));

        assertThat(mvc.get().uri("/api/v1/ping").cookie(stale)).hasStatusOk();
        assertThat(mvc.post().uri("/api/v1/auth/login").with(csrfToken()).cookie(stale)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(credentials(admin.email(), admin.password())))
                .hasStatusOk();
    }

    @Test
    void aValidAdminCookiePassesTheAdminRule() {
        Cookie session = sessionCookie(sessionTokenFrom(login(admin.email(), admin.password())));

        // No admin endpoint exists yet: 404 means authorization let the request through to the dispatcher.
        assertThat(mvc.get().uri("/api/v1/admin/projects").cookie(session)).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(mvc.get().uri("/api/v1/admin/projects")).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void unsafeRequestsWithoutACsrfTokenAreRejected() {
        assertThat(mvc.post().uri("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(credentials(admin.email(), admin.password())))
                .hasStatus(HttpStatus.FORBIDDEN)
                .bodyJson()
                .extractingPath("$.code")
                .isEqualTo("invalid-csrf-token");
    }

    @Test
    void theBrowserDoubleSubmitFlowWorksWithoutTestHelpers() {
        // What the SPA does: any GET hands out XSRF-TOKEN; the POST echoes it in the X-XSRF-TOKEN header.
        Cookie xsrf = mvc.get().uri("/api/v1/ping").exchange().getResponse().getCookie("XSRF-TOKEN");
        assertThat(xsrf).isNotNull();
        assertThat(xsrf.isHttpOnly()).as("the SPA must be able to read it").isFalse();

        assertThat(mvc.post().uri("/api/v1/auth/login")
                        .cookie(xsrf)
                        .header("X-XSRF-TOKEN", xsrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(credentials(admin.email(), admin.password())))
                .hasStatusOk();
    }

    private MvcTestResult login(String email, String password) {
        return login(email, password, "login-test");
    }

    private MvcTestResult login(String email, String password, String correlationId) {
        return mvc.post().uri("/api/v1/auth/login")
                .with(csrfToken())
                .header("X-Correlation-Id", correlationId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(credentials(email, password))
                .exchange();
    }

    private static String credentials(String email, String password) {
        return """
                {"email": "%s", "password": "%s"}
                """.formatted(email, password);
    }

    private static String sessionTokenFrom(MvcTestResult result) {
        Cookie cookie = result.getResponse().getCookie(SessionCookie.NAME);
        assertThat(cookie).as("session cookie").isNotNull();
        return cookie.getValue();
    }

    private static Cookie sessionCookie(String token) {
        return new Cookie(SessionCookie.NAME, token);
    }

    private User storedAdmin() {
        return users.findByEmail("admin@example.test").orElseThrow();
    }

    private static void assertUnauthorized(MvcTestResult result) {
        assertThat(result)
                .hasStatus(HttpStatus.UNAUTHORIZED)
                .hasContentType(MediaType.APPLICATION_PROBLEM_JSON)
                .bodyJson()
                .extractingPath("$.code")
                .isEqualTo("unauthorized");
    }
}
