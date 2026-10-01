package com.sahtechlabs.hub.projects.internal;

import java.time.Clock;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;

/** Use cases for the project catalogue. Controllers stay thin and translate HTTP to and from these calls. */
@Service
class ProjectService {

    private final ProjectRepository projects;
    private final Clock clock;

    ProjectService(ProjectRepository projects, Clock clock) {
        this.projects = projects;
        this.clock = clock;
    }

    List<Project> listPublished() {
        return projects.findByPublishedTrueOrderByDisplayOrderAscIdAsc();
    }

    /** Drafts included: the admin needs to see what is not public yet. */
    List<Project> listAll() {
        return projects.findAllByOrderByDisplayOrderAscIdAsc();
    }

    Project create(
            String title,
            @Nullable String description,
            @Nullable String url,
            @Nullable String imageUrl,
            int displayOrder,
            boolean published) {
        return projects.save(
                Project.create(title, description, url, imageUrl, displayOrder, published, clock.instant()));
    }

    Project replace(
            long id,
            String title,
            @Nullable String description,
            @Nullable String url,
            @Nullable String imageUrl,
            int displayOrder,
            boolean published) {
        Project existing = projects.findById(id).orElseThrow(() -> new ProjectNotFoundException(id));
        return projects.save(existing.replaceContent(title, description, url, imageUrl, displayOrder, published));
    }

    void delete(long id) {
        if (!projects.existsById(id)) {
            throw new ProjectNotFoundException(id);
        }
        projects.deleteById(id);
    }
}
