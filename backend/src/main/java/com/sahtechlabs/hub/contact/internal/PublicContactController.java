package com.sahtechlabs.hub.contact.internal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The public contact form. Public by an explicit permit rule in the identity module's security configuration. */
@RestController
@RequestMapping("/api/v1/contact")
class PublicContactController {

    private static final Logger log = LoggerFactory.getLogger(PublicContactController.class);

    /**
     * {@code website} is a honeypot: the form hides it from people, so only bots fill it in. Plain {@code @Email}
     * accepts addresses such as {@code a@b}; the pattern also requires a dot in the domain.
     */
    record ContactRequest(
            @NotBlank @Size(max = ContactMessage.MAX_NAME_LENGTH) String name,
            @NotBlank @Size(max = ContactMessage.MAX_EMAIL_LENGTH) @Email(regexp = ".+@.+\\..+") String email,
            @NotBlank @Size(max = ContactMessage.MAX_MESSAGE_LENGTH) String message,
            @Nullable String website) {

        /**
         * Trims before validation runs (Jackson builds the record through this constructor), so stray whitespace,
         * such as the trailing space phone keyboards add after an autocompleted address, is not a validation error.
         */
        ContactRequest {
            name = strip(name);
            email = strip(email);
            message = strip(message);
        }

        private static @Nullable String strip(@Nullable String value) {
            return value == null ? null : value.strip();
        }

        boolean filledHoneypot() {
            return website != null && !website.isBlank();
        }
    }

    private final ContactService service;

    PublicContactController(ContactService service) {
        this.service = service;
    }

    /**
     * 202 with no body for every valid submission, honeypot or not, so a bot cannot tell which path it took. The
     * honeypot is checked after validation for the same reason: an invalid request is rejected either way. A
     * deterrent for simple bots, not a security control; rate limiting arrives with M6.
     */
    @PostMapping
    ResponseEntity<Void> submit(@Valid @RequestBody ContactRequest request) {
        if (request.filledHoneypot()) {
            // Counted, not described: nothing from the request is logged, because it may be personal data.
            log.info("Contact honeypot triggered; submission discarded");
        } else {
            service.submit(request.name(), request.email(), request.message());
        }
        return ResponseEntity.accepted().build();
    }
}
