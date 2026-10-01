package com.sahtechlabs.hub.projects.internal;

import java.util.List;
import org.springframework.stereotype.Service;

/** Use cases for the project catalogue. Controllers stay thin and translate HTTP to and from these calls. */
@Service
class ProjectService {

    private final ProjectRepository projects;

    ProjectService(ProjectRepository projects) {
        this.projects = projects;
    }

    List<Project> listPublished() {
        return projects.findByPublishedTrueOrderByDisplayOrderAscIdAsc();
    }
}
