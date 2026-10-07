package com.sahtechlabs.hub.contact.internal;

import java.time.Instant;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

/**
 * A message from the public contact form. The rules live here as well as on the request DTO, so no code path can
 * store a message the inbox cannot show. Holds personal data: never log the name, email or message.
 */
@Table("contact_message")
record ContactMessage(
        @Id @Nullable Long id, String name, String email, String message, Instant createdAt, boolean read) {

    static final int MAX_NAME_LENGTH = 200;
    static final int MAX_EMAIL_LENGTH = 254;
    static final int MAX_MESSAGE_LENGTH = 5000;

    ContactMessage {
        requireText("name", name, MAX_NAME_LENGTH);
        requireText("email", email, MAX_EMAIL_LENGTH);
        requireText("message", message, MAX_MESSAGE_LENGTH);
        Objects.requireNonNull(createdAt, "createdAt");
    }

    /** New messages are unread: the admin has not seen them yet. */
    static ContactMessage create(String name, String email, String message, Instant createdAt) {
        return new ContactMessage(null, name, email, message, createdAt, false);
    }

    /** Marking read is idempotent; everything else about the message stays as it was sent. */
    ContactMessage markedRead() {
        return read ? this : new ContactMessage(id, name, email, message, createdAt, true);
    }

    /** The id of a message that has been saved; calling this on an unsaved message is a programming error. */
    long savedId() {
        if (id == null) {
            throw new IllegalStateException("contact message has not been saved yet");
        }
        return id;
    }

    // Messages name the field, never its value: the value is personal data and exception messages reach logs.
    private static void requireText(String field, String value, int maxLength) {
        Objects.requireNonNull(value, field);
        if (value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
        if (value.length() > maxLength) {
            throw new IllegalArgumentException(field + " must be at most " + maxLength + " characters");
        }
    }
}
