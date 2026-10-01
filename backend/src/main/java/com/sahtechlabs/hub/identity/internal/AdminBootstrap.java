package com.sahtechlabs.hub.identity.internal;

import java.time.Clock;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Creates the one admin account on the first start against an empty database. Once any user exists it does nothing,
 * so restarts never overwrite or duplicate the admin, and changing the variables later has no effect.
 */
@Component
@EnableConfigurationProperties(AdminBootstrapProperties.class)
class AdminBootstrap implements CommandLineRunner {

    static final int MINIMUM_PASSWORD_LENGTH = 12;

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;
    private final AdminBootstrapProperties properties;

    AdminBootstrap(
            UserRepository users, PasswordEncoder passwordEncoder, Clock clock, AdminBootstrapProperties properties) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
        this.properties = properties;
    }

    @Override
    public void run(String... args) {
        if (users.count() > 0) {
            return;
        }
        String email = require(properties.email(), "HUB_ADMIN_EMAIL");
        String password = require(properties.password(), "HUB_ADMIN_PASSWORD");
        if (password.length() < MINIMUM_PASSWORD_LENGTH) {
            throw new IllegalStateException(
                    "HUB_ADMIN_PASSWORD must be at least " + MINIMUM_PASSWORD_LENGTH + " characters long.");
        }

        User admin = users.save(User.newAdmin(email, passwordEncoder.encode(password), clock.instant()));
        // Log the id only: the email is personal data and the password must never be logged in any form.
        log.info("Created the initial admin user (id={})", admin.id());
    }

    private static String require(@Nullable String value, String variable) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(variable + " is not set. It is required on first start to create the"
                    + " admin user, because the user table is empty.");
        }
        return value;
    }
}
