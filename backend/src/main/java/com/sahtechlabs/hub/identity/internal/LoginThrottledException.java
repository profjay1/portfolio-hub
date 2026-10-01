package com.sahtechlabs.hub.identity.internal;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * 429 as Problem Details. As an ErrorResponseException it goes through the shared advice like framework errors do
 * (which adds the correlation id) without the shared module having to know about identity's internals.
 *
 * <p>The detail is deliberately vague: no attempt counts and no reset time (and no Retry-After header). The same
 * response is given for every email, existing or not.
 */
final class LoginThrottledException extends ErrorResponseException {

    LoginThrottledException() {
        super(HttpStatus.TOO_MANY_REQUESTS, problem(), null);
    }

    private static ProblemDetail problem() {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.TOO_MANY_REQUESTS, "Too many failed sign-in attempts. Try again later.");
        problem.setProperty("code", "too-many-attempts");
        return problem;
    }
}
