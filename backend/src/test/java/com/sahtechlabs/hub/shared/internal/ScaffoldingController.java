package com.sahtechlabs.hub.shared.internal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * TEMPORARY, test sources only: there are no real endpoints yet, so this gives the error handling and correlation id
 * something to act on. {@code @TestComponent} keeps it out of component scanning; tests {@code @Import} it explicitly.
 * Replace these tests' use of it with real endpoints once the first module exposes one, then delete this class.
 */
@TestComponent
@RestController
class ScaffoldingController {

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
