package com.sahtechlabs.hub.resume.internal;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** Carries its own Problem Detail, like {@code ProjectNotFoundException}, so the shared advice can render it. */
class InvalidResumeException extends ErrorResponseException {

    private InvalidResumeException(HttpStatus status, String code, String title, String detail) {
        super(status, problem(status, code, title, detail), null);
    }

    static InvalidResumeException empty() {
        return new InvalidResumeException(
                HttpStatus.BAD_REQUEST, "resume-empty", "Empty file", "The uploaded file is empty.");
    }

    static InvalidResumeException notPdf() {
        return new InvalidResumeException(
                HttpStatus.BAD_REQUEST, "resume-not-pdf", "Unsupported file type", "Only PDF files are accepted.");
    }

    static InvalidResumeException tooLarge(long maxMegabytes) {
        return new InvalidResumeException(
                HttpStatus.CONTENT_TOO_LARGE,
                "resume-too-large",
                "File too large",
                "The file exceeds the " + maxMegabytes + " MB limit.");
    }

    private static ProblemDetail problem(HttpStatus status, String code, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        problem.setProperty("code", code);
        return problem;
    }
}
