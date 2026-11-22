package com.sahtechlabs.hub;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse.BodyHandlers;
import java.util.Arrays;
import org.apache.catalina.util.NetMaskSet;
import org.apache.catalina.valves.RemoteIpValve;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.tomcat.TomcatWebServer;
import org.springframework.boot.web.server.servlet.context.ServletWebServerApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * In production the backend sits behind Caddy and the frontend's nginx, so the client's scheme and address arrive in
 * X-Forwarded-Proto and X-Forwarded-For. Tomcat applies them in a valve that only runs on a real server, hence the
 * random port. The addresses below are a documentation range (RFC 5737) and a typical Docker bridge address.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("prod")
@Import({TestcontainersConfiguration.class, ForwardedHeadersTests.RequestEcho.class})
class ForwardedHeadersTests {

    private static final String CLIENT_ADDRESS = "203.0.113.7";

    @LocalServerPort
    private int port;

    @Autowired
    private ServletWebServerApplicationContext context;

    @Test
    void appliesTheForwardedSchemeAndClientAddressFromATrustedPeer() throws Exception {
        // The test client connects from loopback, which is inside Tomcat's internal proxies, like the nginx container.
        var request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/forwarded-test/echo"))
                .header("X-Forwarded-Proto", "https")
                .header("X-Forwarded-For", CLIENT_ADDRESS)
                .build();

        var response = HttpClient.newHttpClient().send(request, BodyHandlers.ofString());

        assertThat(response.body()).isEqualTo("https " + CLIENT_ADDRESS + " secure");
    }

    @Test
    void trustsForwardedHeadersOnlyFromPrivateRangePeers() throws Exception {
        // A test request always arrives from loopback, so the public-peer case is checked against the valve itself.
        // Boot configures the internal proxies as a CIDR list, which Tomcat holds as a NetMaskSet.
        var valve = remoteIpValve();
        var internalProxies = NetMaskSet.parse(valve.getInternalProxies());

        assertThat(internalProxies.contains("172.18.0.3")).isTrue();
        assertThat(internalProxies.contains("127.0.0.1")).isTrue();
        assertThat(internalProxies.contains(CLIENT_ADDRESS)).isFalse();
        assertThat(valve.getTrustedProxies()).isNull();
    }

    private RemoteIpValve remoteIpValve() {
        var tomcat = ((TomcatWebServer) context.getWebServer()).getTomcat();
        return Arrays.stream(tomcat.getEngine().getPipeline().getValves())
                .filter(RemoteIpValve.class::isInstance)
                .map(RemoteIpValve.class::cast)
                .findFirst()
                .orElseThrow();
    }

    /** Echoes what the application sees of the request. Its own filter chain leaves the production rules untouched. */
    @TestComponent
    @RestController
    @Import(RequestEcho.PermitEcho.class)
    static class RequestEcho {

        @TestConfiguration(proxyBeanMethods = false)
        static class PermitEcho {

            @Bean
            @Order(Ordered.HIGHEST_PRECEDENCE)
            SecurityFilterChain echoSecurity(HttpSecurity http) {
                http.securityMatcher("/forwarded-test/**")
                        .authorizeHttpRequests(requests -> requests.anyRequest().permitAll());
                return http.build();
            }
        }

        @GetMapping("/forwarded-test/echo")
        String echo(HttpServletRequest request) {
            var security = request.isSecure() ? "secure" : "insecure";
            return request.getScheme() + " " + request.getRemoteAddr() + " " + security;
        }
    }
}
