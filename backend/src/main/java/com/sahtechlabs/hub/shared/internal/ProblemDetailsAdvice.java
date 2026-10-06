package com.sahtechlabs.hub.shared.internal;

import java.util.Comparator;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * The single place that turns exceptions into RFC 9457 Problem Details. Every response carries a stable {@code code}
 * that clients can branch on (titles and details are for humans and may change) and the request's correlation id.
 * Framework exceptions (unknown path, wrong method, unreadable body) are handled by the superclass and pass through
 * {@link #handleExceptionInternal} to get the same properties.
 */
@RestControllerAdvice
class ProblemDetailsAdvice extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ProblemDetailsAdvice.class);

    record FieldError(String field, String message) {}

    @Override
    protected @Nullable ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, "The request contains invalid fields.");
        problem.setTitle("Validation failed");
        problem.setProperty("code", "validation-failed");
        problem.setProperty("errors", ex.getBindingResult().getFieldErrors().stream()
                .map(error -> new FieldError(error.getField(), error.getDefaultMessage()))
                .sorted(Comparator.comparing(FieldError::field))
                .toList());
        return handleExceptionInternal(ex, problem, headers, status, request);
    }

    @Override
    protected @Nullable ResponseEntity<Object> handleMaxUploadSizeExceededException(
            MaxUploadSizeExceededException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        // The container rejected the body before any controller saw it; modules may add their own, tighter limits.
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, "The uploaded file is too large.");
        problem.setTitle("File too large");
        problem.setProperty("code", "file-too-large");
        return handleExceptionInternal(ex, problem, headers, status, request);
    }

    @ExceptionHandler(BadCredentialsException.class)
    ResponseEntity<Object> handleBadCredentials(BadCredentialsException ex, WebRequest request) {
        // One message for "no such account" and "wrong password", so the response cannot be used to find accounts.
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.UNAUTHORIZED, "The email or password is incorrect.");
        problem.setProperty("code", "invalid-credentials");
        return handleExceptionInternal(ex, problem, new HttpHeaders(), HttpStatus.UNAUTHORIZED, request);
    }

    @ExceptionHandler(CsrfException.class)
    ResponseEntity<Object> handleCsrf(CsrfException ex, WebRequest request) {
        // Distinct code so the frontend can tell "fetch a fresh token and retry" apart from a real permission problem.
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.FORBIDDEN, "The request is missing a valid CSRF token.");
        problem.setProperty("code", "invalid-csrf-token");
        return handleExceptionInternal(ex, problem, new HttpHeaders(), HttpStatus.FORBIDDEN, request);
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<Object> handleUnauthenticated(AuthenticationException ex, WebRequest request) {
        // Deliberately generic: never say whether the account exists or which credential was wrong.
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        problem.setProperty("code", "unauthorized");
        return handleExceptionInternal(ex, problem, new HttpHeaders(), HttpStatus.UNAUTHORIZED, request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<Object> handleForbidden(AccessDeniedException ex, WebRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.FORBIDDEN, "You do not have permission to perform this action.");
        problem.setProperty("code", "forbidden");
        return handleExceptionInternal(ex, problem, new HttpHeaders(), HttpStatus.FORBIDDEN, request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Object> handleUnexpected(Exception ex, WebRequest request) {
        // The stack trace goes to the log, correlated by id; the client only gets a generic message.
        log.error("Unhandled exception", ex);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred.");
        problem.setProperty("code", "internal-error");
        return handleExceptionInternal(ex, problem, new HttpHeaders(), HttpStatus.INTERNAL_SERVER_ERROR, request);
    }

    @Override
    protected @Nullable ResponseEntity<Object> handleExceptionInternal(
            Exception ex, @Nullable Object body, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        // Framework exceptions arrive with a null body and the superclass builds the ProblemDetail, so decorate the
        // result rather than the argument.
        ResponseEntity<Object> response = super.handleExceptionInternal(ex, body, headers, status, request);
        if (response != null && response.getBody() instanceof ProblemDetail problem) {
            if (problem.getProperties() == null || !problem.getProperties().containsKey("code")) {
                problem.setProperty("code", codeFor(status));
            }
            String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
            if (correlationId != null) {
                problem.setProperty("correlationId", correlationId);
            }
        }
        return response;
    }

    /** {@code 404 -> "not-found"}, {@code 405 -> "method-not-allowed"}: stable because HTTP reason phrases are. */
    private static String codeFor(HttpStatusCode status) {
        HttpStatus known = HttpStatus.resolve(status.value());
        return known == null ? "http-" + status.value() : known.name().toLowerCase(Locale.ROOT).replace('_', '-');
    }
}
