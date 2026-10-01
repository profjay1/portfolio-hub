package com.sahtechlabs.hub.shared.internal;

import static org.assertj.core.api.Assertions.assertThat;

import com.sahtechlabs.hub.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("prod")
@Import({TestcontainersConfiguration.class, ScaffoldingController.class})
@ExtendWith(OutputCaptureExtension.class)
class StructuredLoggingTests {

    @Autowired
    private MockMvcTester mvc;

    @Test
    void prodLogsAreJsonLinesThatCarryTheCorrelationId(CapturedOutput output) {
        mvc.get().uri("/scaffolding/failure").header(CorrelationIdFilter.HEADER, "trace-me-12345").exchange();

        String errorLine = output.getOut().lines()
                .filter(line -> line.contains("Unhandled exception"))
                .findFirst()
                .orElseThrow();
        assertThat(errorLine)
                .startsWith("{")
                .contains("\"correlationId\":\"trace-me-12345\"")
                .contains("\"log\":{\"level\":\"ERROR\"");
    }
}
