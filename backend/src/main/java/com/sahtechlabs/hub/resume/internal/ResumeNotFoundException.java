package com.sahtechlabs.hub.resume.internal;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** Nothing has been uploaded yet, so there is no resume to download. */
class ResumeNotFoundException extends ErrorResponseException {

    ResumeNotFoundException() {
        super(HttpStatus.NOT_FOUND, problem(), null);
    }

    private static ProblemDetail problem() {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "No resume is available yet.");
        problem.setTitle("Resume not found");
        problem.setProperty("code", "resume-not-found");
        return problem;
    }
}
