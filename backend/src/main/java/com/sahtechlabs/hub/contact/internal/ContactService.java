package com.sahtechlabs.hub.contact.internal;

import java.time.Clock;
import java.util.List;
import org.springframework.stereotype.Service;

/** Use cases for contact messages. Controllers stay thin and translate HTTP to and from these calls. */
@Service
class ContactService {

    private final ContactMessageRepository messages;
    private final Clock clock;

    ContactService(ContactMessageRepository messages, Clock clock) {
        this.messages = messages;
        this.clock = clock;
    }

    ContactMessage submit(String name, String email, String message) {
        return messages.save(ContactMessage.create(name, email, message, clock.instant()));
    }

    List<ContactMessage> list() {
        return messages.findAllByOrderByCreatedAtDescIdDesc();
    }

    void markRead(long id) {
        ContactMessage existing = messages.findById(id).orElseThrow(() -> new ContactMessageNotFoundException(id));
        if (!existing.read()) {
            messages.save(existing.markedRead());
        }
    }
}
