package com.sahtechlabs.hub.identity.internal;

import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

/** An account that can sign in. The id is null until the database assigns it on first save. */
@Table("app_user")
record User(@Id @Nullable Long id, String email, String passwordHash, Role role, Instant createdAt) {

    User {
        Objects.requireNonNull(email, "email");
        Objects.requireNonNull(passwordHash, "passwordHash");
        Objects.requireNonNull(role, "role");
        Objects.requireNonNull(createdAt, "createdAt");
        if (email.isBlank()) {
            throw new IllegalArgumentException("email must not be blank");
        }
    }

    static User newAdmin(String email, String passwordHash, Instant createdAt) {
        return new User(null, normalise(email), passwordHash, Role.ADMIN, createdAt);
    }

    /** Emails are compared case-insensitively; storing them lower-cased keeps the unique constraint honest. */
    static String normalise(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }
}
