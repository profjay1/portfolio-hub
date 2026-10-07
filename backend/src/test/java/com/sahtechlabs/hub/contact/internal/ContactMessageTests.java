package com.sahtechlabs.hub.contact.internal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;
import static org.assertj.core.api.Assertions.assertThatIllegalStateException;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ContactMessageTests {

    private static final Instant SENT = Instant.parse("2026-10-06T12:00:00Z");

    private static ContactMessage message(String name, String email, String text) {
        return ContactMessage.create(name, email, text, SENT);
    }

    @Test
    void aNewMessageIsUnreadAndHasNoIdUntilSaved() {
        ContactMessage message = message("Ada", "ada@example.com", "Hello");

        assertThat(message.read()).isFalse();
        assertThat(message.id()).isNull();
        assertThatIllegalStateException().isThrownBy(message::savedId);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void rejectsBlankFields(String blank) {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> message(blank, "ada@example.com", "Hello"))
                .withMessageContaining("name");
        assertThatIllegalArgumentException()
                .isThrownBy(() -> message("Ada", blank, "Hello"))
                .withMessageContaining("email");
        assertThatIllegalArgumentException()
                .isThrownBy(() -> message("Ada", "ada@example.com", blank))
                .withMessageContaining("message");
    }

    @Test
    void rejectsValuesLongerThanTheirColumns() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> message("a".repeat(201), "ada@example.com", "Hello"))
                .withMessageContaining("name");
        assertThatIllegalArgumentException()
                .isThrownBy(() -> message("Ada", "a".repeat(243) + "@example.com", "Hello"))
                .withMessageContaining("email");
        assertThatIllegalArgumentException()
                .isThrownBy(() -> message("Ada", "ada@example.com", "a".repeat(5001)))
                .withMessageContaining("message");
    }

    @Test
    void rejectionMessagesNeverContainThePersonalDataItself() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> message("Ada", "ada@example.com", "secret ".repeat(1000)))
                .withMessageNotContaining("secret");
    }

    @Test
    void markingReadKeepsEverythingElseAsSent() {
        ContactMessage unread = new ContactMessage(7L, "Ada", "ada@example.com", "Hello", SENT, false);

        ContactMessage read = unread.markedRead();

        assertThat(read).isEqualTo(new ContactMessage(7L, "Ada", "ada@example.com", "Hello", SENT, true));
        assertThat(read.markedRead()).isSameAs(read);
    }
}
