package com.sahtechlabs.hub.contact.internal;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * Carries its own Problem Detail, so the shared advice renders it (adding the correlation id) without this module
 * depending on {@code shared.internal}.
 */
class ContactMessageNotFoundException extends ErrorResponseException {

    ContactMessageNotFoundException(long id) {
        super(HttpStatus.NOT_FOUND, problem(id), null);
    }

    private static ProblemDetail problem(long id) {
        ProblemDetail problem =
                ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "No contact message has id " + id + ".");
        problem.setTitle("Contact message not found");
        problem.setProperty("code", "contact-message-not-found");
        return problem;
    }
}
