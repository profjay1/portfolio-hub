package com.sahtechlabs.hub.projects.internal;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * Carries its own Problem Detail, so the shared advice renders it (adding the correlation id) without this module
 * depending on {@code shared.internal}.
 */
class ProjectNotFoundException extends ErrorResponseException {

    ProjectNotFoundException(long id) {
        super(HttpStatus.NOT_FOUND, problem(id), null);
    }

    private static ProblemDetail problem(long id) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "No project has id " + id + ".");
        problem.setTitle("Project not found");
        problem.setProperty("code", "project-not-found");
        return problem;
    }
}
