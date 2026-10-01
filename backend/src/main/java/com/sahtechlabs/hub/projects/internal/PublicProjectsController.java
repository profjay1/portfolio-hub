package com.sahtechlabs.hub.projects.internal;

import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The visitor-facing catalogue: published projects only, without admin fields such as the publish flag. */
@RestController
@RequestMapping("/api/v1/projects")
class PublicProjectsController {

    record PublicProject(
            long id,
            String title,
            @Nullable String description,
            @Nullable String url,
            @Nullable String imageUrl,
            int displayOrder) {

        static PublicProject from(Project project) {
            return new PublicProject(
                    project.savedId(),
                    project.title(),
                    project.description(),
                    project.url(),
                    project.imageUrl(),
                    project.displayOrder());
        }
    }

    private final ProjectService service;

    PublicProjectsController(ProjectService service) {
        this.service = service;
    }

    @GetMapping
    List<PublicProject> list() {
        return service.listPublished().stream().map(PublicProject::from).toList();
    }
}
