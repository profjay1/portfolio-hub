package com.sahtechlabs.hub.shared.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.InstanceOfAssertFactories.MAP;

import com.sahtechlabs.hub.TestcontainersConfiguration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, ScaffoldingController.class})
class ProblemDetailsTests {

    @Autowired
    private MockMvcTester mvc;

    @Test
    void validationFailuresListEveryOffendingField() {
        var response = mvc.post().uri("/scaffolding/greetings")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": " ", "email": "not-an-email"}
                        """);

        assertThat(response)
                .hasStatus(HttpStatus.BAD_REQUEST)
                .hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
        var body = assertThat(response).bodyJson();
        body.extractingPath("$.code").isEqualTo("validation-failed");
        body.extractingPath("$.status").isEqualTo(400);
        body.extractingPath("$.errors[*].field").asList().containsExactly("email", "name");
    }

    @Test
    void unexpectedFailuresReturnAGenericProblemWithoutInternals() {
        var response = mvc.get().uri("/scaffolding/failure");

        assertThat(response)
                .hasStatus(HttpStatus.INTERNAL_SERVER_ERROR)
                .hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(response).bodyJson().extractingPath("$")
                .asInstanceOf(MAP)
                .containsEntry("code", "internal-error")
                .containsEntry("detail", "An unexpected error occurred.")
                .doesNotContainKeys("trace", "exception", "message");
        assertThat(response).bodyText()
                .doesNotContain("internal detail", "IllegalStateException", "com.sahtechlabs");
    }

    @Test
    void unknownPathsReturnANotFoundProblem() {
        assertThat(mvc.get().uri("/no-such-path"))
                .hasStatus(HttpStatus.NOT_FOUND)
                .hasContentType(MediaType.APPLICATION_PROBLEM_JSON)
                .bodyJson()
                .extractingPath("$.code")
                .isEqualTo("not-found");
    }

    @Test
    void malformedJsonReturnsABadRequestProblemWithoutParserInternals() {
        var response = mvc.post().uri("/scaffolding/greetings")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":");

        assertThat(response).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(response).bodyJson().extractingPath("$.code").isEqualTo("bad-request");
        assertThat(response).bodyText().doesNotContain("jackson", "Unexpected end-of-input");
    }

    @Test
    void everyProblemCarriesTheRequestsCorrelationId() {
        var response = mvc.get().uri("/scaffolding/failure").header(CorrelationIdFilter.HEADER, "support-ticket-42");

        assertThat(response).hasHeader(CorrelationIdFilter.HEADER, "support-ticket-42");
        assertThat(response).bodyJson().extractingPath("$.correlationId").isEqualTo("support-ticket-42");
    }

    @Test
    void generatesACorrelationIdWhenTheCallerSendsNone() {
        var response = mvc.post().uri("/scaffolding/greetings")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"name": "Ada", "email": "ada@example.test"}
                        """)
                .exchange();

        assertThat(response).hasStatusOk();
        assertThat(response.getResponse().getHeader(CorrelationIdFilter.HEADER))
                .matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    }

    @Test
    void replacesCallerCorrelationIdsThatCouldForgeLogLines() {
        for (String unsafe : List.of("abc\r\nFAKE LOG LINE", "short", "x".repeat(65), "<script>alert(1)</script>")) {
            var response = mvc.get().uri("/no-such-path").header(CorrelationIdFilter.HEADER, unsafe).exchange();

            assertThat(response.getResponse().getHeader(CorrelationIdFilter.HEADER))
                    .as("correlation id returned when the caller sent %s", unsafe)
                    .isNotEqualTo(unsafe)
                    .matches("[0-9a-f-]{36}");
        }
    }
}
