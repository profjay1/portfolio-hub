package com.sahtechlabs.hub.contact.internal;

import static com.sahtechlabs.hub.BrowserCsrf.csrfToken;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;

import com.sahtechlabs.hub.TestcontainersConfiguration;
import java.time.Instant;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@ExtendWith(OutputCaptureExtension.class)
class ContactApiTests {

    private static final String CONTACT = "/api/v1/contact";
    private static final String ADMIN_CONTACT = "/api/v1/admin/contact";

    private static final String VALID_BODY = """
            {"name": "Ada Lovelace", "email": "ada@example.com", "message": "Are you open to new roles?"}
            """;

    @Autowired
    private MockMvcTester mvc;

    @Autowired
    private ContactMessageRepository messages;

    @BeforeEach
    void startEmpty() {
        // Test classes share one context and database, so each test starts from a known state.
        messages.deleteAll();
    }

    private MvcTestResult submit(String json) {
        return mvc.post().uri(CONTACT).with(csrfToken()).contentType(MediaType.APPLICATION_JSON).content(json)
                .exchange();
    }

    private ContactMessage saved(String name, Instant createdAt) {
        return messages.save(ContactMessage.create(name, "someone@example.com", "Hello", createdAt));
    }

    // --- Public submission ---

    @Test
    void aVisitorCanSendAMessageWhichIsStoredUnread() {
        var response = submit("""
                {"name": "  Ada Lovelace ", "email": " ada@example.com ", "message": "  Are you open to new roles?\\n"}
                """);

        assertThat(response).hasStatus(HttpStatus.ACCEPTED);
        assertThat(response).body().isEmpty();
        assertThat(messages.findAll()).singleElement().satisfies(message -> {
            assertThat(message.name()).isEqualTo("Ada Lovelace");
            assertThat(message.email()).isEqualTo("ada@example.com");
            assertThat(message.message()).isEqualTo("Are you open to new roles?");
            assertThat(message.read()).isFalse();
            assertThat(message.createdAt()).isNotNull();
        });
    }

    @Test
    void aFilledHoneypotGetsTheSameResponseButNothingIsStored(CapturedOutput output) {
        var real = submit(VALID_BODY);
        messages.deleteAll();

        var bot = submit("""
                {"name": "Spam Bot", "email": "bot@spam.example", "message": "Buy now", "website": "https://spam.example"}
                """);

        assertThat(bot).hasStatus(real.getResponse().getStatus());
        assertThat(bot.getResponse().getContentAsByteArray()).isEqualTo(real.getResponse().getContentAsByteArray());
        assertThat(messages.count()).isZero();
        assertThat(output).contains("Contact honeypot triggered").doesNotContain("bot@spam.example", "Spam Bot");
    }

    @Test
    void aBlankHoneypotIsTreatedAsARealSubmission() {
        var response = submit("""
                {"name": "Ada", "email": "ada@example.com", "message": "Hello", "website": "  "}
                """);

        assertThat(response).hasStatus(HttpStatus.ACCEPTED);
        assertThat(messages.count()).isOne();
    }

    static Stream<Arguments> invalidSubmissions() {
        return Stream.of(
                Arguments.of("blank name", """
                        {"name": "  ", "email": "ada@example.com", "message": "Hello"}""", "name"),
                Arguments.of("missing name", """
                        {"email": "ada@example.com", "message": "Hello"}""", "name"),
                Arguments.of("blank message", """
                        {"name": "Ada", "email": "ada@example.com", "message": ""}""", "message"),
                Arguments.of("malformed email", """
                        {"name": "Ada", "email": "not-an-email", "message": "Hello"}""", "email"),
                Arguments.of("email without a dot in the domain", """
                        {"name": "Ada", "email": "ada@localhost", "message": "Hello"}""", "email"),
                Arguments.of("missing email", """
                        {"name": "Ada", "message": "Hello"}""", "email"),
                Arguments.of("name too long", """
                        {"name": "%s", "email": "ada@example.com", "message": "Hello"}""".formatted("a".repeat(201)),
                        "name"),
                Arguments.of("message too long", """
                        {"name": "Ada", "email": "ada@example.com", "message": "%s"}""".formatted("a".repeat(5001)),
                        "message"));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("invalidSubmissions")
    void rejectsInvalidSubmissionsNamingTheField(String description, String json, String field) {
        var response = submit(json);

        assertThat(response).hasStatus(HttpStatus.BAD_REQUEST);
        var body = assertThat(response).bodyJson();
        body.extractingPath("$.code").isEqualTo("validation-failed");
        body.extractingPath("$.errors[*].field").asArray().containsExactly(field);
        assertThat(messages.count()).isZero();
    }

    @Test
    void aHoneypotSubmissionWithInvalidFieldsIsRejectedLikeAnyOther() {
        var response = submit("""
                {"name": "Bot", "email": "nope", "message": "Buy", "website": "https://spam.example"}
                """);

        assertThat(response).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("validation-failed");
    }

    @Test
    void submissionsRequireACsrfToken() {
        var response = mvc.post().uri(CONTACT).contentType(MediaType.APPLICATION_JSON).content(VALID_BODY)
                .exchange();

        assertThat(response).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("invalid-csrf-token");
        assertThat(messages.count()).isZero();
    }

    @Test
    void theContactEndpointIsWriteOnlyForThePublic() {
        assertThat(mvc.get().uri(CONTACT)).hasStatus(HttpStatus.UNAUTHORIZED);
    }

    // --- Admin endpoints ---

    /** Every admin operation, sent with a valid CSRF token so the authorization rules are what decide. */
    static Stream<Arguments> adminOperations() {
        return Stream.of(
                Arguments.of(HttpMethod.GET, ADMIN_CONTACT),
                Arguments.of(HttpMethod.PATCH, ADMIN_CONTACT + "/1/read"));
    }

    private MvcTestResult send(HttpMethod method, String uri) {
        return mvc.method(method).uri(uri).with(csrfToken()).exchange();
    }

    @ParameterizedTest
    @MethodSource("adminOperations")
    void anonymousCallersAreRejectedFromAdminOperations(HttpMethod method, String uri) {
        var response = send(method, uri);

        assertThat(response).hasStatus(HttpStatus.UNAUTHORIZED);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("unauthorized");
    }

    @ParameterizedTest
    @MethodSource("adminOperations")
    @WithMockUser(roles = "VISITOR")
    void nonAdminCallersAreRejectedFromAdminOperations(HttpMethod method, String uri) {
        var response = send(method, uri);

        assertThat(response).hasStatus(HttpStatus.FORBIDDEN);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("forbidden");
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void aRejectedMarkReadChangesNothing(boolean asVisitor) {
        ContactMessage existing = saved("Ada", Instant.parse("2026-10-06T12:00:00Z"));
        var request = mvc.patch().uri(ADMIN_CONTACT + "/" + existing.savedId() + "/read").with(csrfToken());
        if (asVisitor) {
            request = request.with(user("visitor").roles("VISITOR"));
        }

        request.exchange();

        assertThat(messages.findById(existing.savedId())).get().extracting(ContactMessage::read).isEqualTo(false);
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void theInboxListsMessagesNewestFirstWithReadStatus() {
        saved("Oldest", Instant.parse("2026-10-01T09:00:00Z"));
        ContactMessage newest = saved("Newest", Instant.parse("2026-10-06T09:00:00Z"));
        saved("Middle", Instant.parse("2026-10-03T09:00:00Z"));
        messages.save(newest.markedRead());

        var body = assertThat(mvc.get().uri(ADMIN_CONTACT)).hasStatusOk().bodyJson();

        body.extractingPath("$[*].name").asArray().containsExactly("Newest", "Middle", "Oldest");
        body.extractingPath("$[*].read").asArray().containsExactly(true, false, false);
        body.extractingPath("$[0]")
                .asMap()
                .containsOnlyKeys("id", "name", "email", "message", "createdAt", "read");
        body.extractingPath("$[0].createdAt").isEqualTo("2026-10-06T09:00:00Z");
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void messagesSentInTheSameInstantListInAStableOrder() {
        Instant same = Instant.parse("2026-10-06T09:00:00Z");
        saved("First saved", same);
        saved("Second saved", same);

        assertThat(mvc.get().uri(ADMIN_CONTACT)).bodyJson().extractingPath("$[*].name").asArray()
                .containsExactly("Second saved", "First saved");
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void markingAMessageReadPersistsAndCanBeRepeated() {
        ContactMessage message = saved("Ada", Instant.parse("2026-10-06T12:00:00Z"));
        String uri = ADMIN_CONTACT + "/" + message.savedId() + "/read";

        assertThat(mvc.patch().uri(uri).with(csrfToken())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(messages.findById(message.savedId())).get().extracting(ContactMessage::read).isEqualTo(true);

        assertThat(mvc.patch().uri(uri).with(csrfToken())).hasStatus(HttpStatus.NO_CONTENT);
        assertThat(messages.findById(message.savedId())).get().satisfies(after -> {
            assertThat(after.read()).isTrue();
            assertThat(after.name()).isEqualTo("Ada");
            assertThat(after.createdAt()).isEqualTo(message.createdAt());
        });
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void markingAnUnknownMessageReadIsNotFound() {
        var response = mvc.patch().uri(ADMIN_CONTACT + "/999999/read").with(csrfToken()).exchange();

        assertThat(response).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("contact-message-not-found");
    }
}
