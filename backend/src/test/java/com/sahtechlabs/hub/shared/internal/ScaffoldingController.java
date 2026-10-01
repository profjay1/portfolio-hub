package com.sahtechlabs.hub.shared.internal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * TEMPORARY, test sources only: there are no real endpoints yet, so this gives the error handling and correlation id
 * something to act on. {@code @TestComponent} keeps it out of component scanning; tests {@code @Import} it explicitly.
 * Replace these tests' use of it with real endpoints once the first module exposes one, then delete this class.
 * It brings its own filter chain permitting {@code /scaffolding/**}, so the production deny-by-default rules stay
 * untouched.
 */
@TestComponent
@RestController
@Import(ScaffoldingController.PermitScaffolding.class)
class ScaffoldingController {

    @TestConfiguration(proxyBeanMethods = false)
    static class PermitScaffolding {

        @Bean
        @Order(Ordered.HIGHEST_PRECEDENCE)
        SecurityFilterChain scaffoldingSecurity(HttpSecurity http) {
            http.securityMatcher("/scaffolding/**")
                    .csrf(AbstractHttpConfigurer::disable)
                    .authorizeHttpRequests(requests -> requests.anyRequest().permitAll());
            return http.build();
        }
    }

    record Greeting(@NotBlank String name, @NotBlank @Email String email) {}

    @PostMapping("/scaffolding/greetings")
    Greeting echo(@Valid @RequestBody Greeting greeting) {
        return greeting;
    }

    @GetMapping("/scaffolding/failure")
    Greeting fail() {
        throw new IllegalStateException("internal detail that must not reach the client");
    }
}
