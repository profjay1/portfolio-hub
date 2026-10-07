package com.sahtechlabs.hub.contact.internal;

import java.time.Instant;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Admin-only by the {@code /api/v1/admin/**} rule in the identity module's security configuration. */
@RestController
@RequestMapping("/api/v1/admin/contact")
class AdminContactController {

    record AdminContactMessage(long id, String name, String email, String message, Instant createdAt, boolean read) {

        static AdminContactMessage from(ContactMessage message) {
            return new AdminContactMessage(
                    message.savedId(),
                    message.name(),
                    message.email(),
                    message.message(),
                    message.createdAt(),
                    message.read());
        }
    }

    private final ContactService service;

    AdminContactController(ContactService service) {
        this.service = service;
    }

    @GetMapping
    List<AdminContactMessage> list() {
        return service.list().stream().map(AdminContactMessage::from).toList();
    }

    /** Idempotent: marking an already-read message read again is a no-op, not an error. */
    @PatchMapping("/{id}/read")
    ResponseEntity<Void> markRead(@PathVariable long id) {
        service.markRead(id);
        return ResponseEntity.noContent().build();
    }
}
