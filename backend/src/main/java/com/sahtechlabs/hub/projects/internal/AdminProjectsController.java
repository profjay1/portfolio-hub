package com.sahtechlabs.hub.projects.internal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/** Admin-only by the {@code /api/v1/admin/**} rule in the identity module's security configuration. */
@RestController
@RequestMapping("/api/v1/admin/projects")
class AdminProjectsController {

    /**
     * Create and full replace share one shape. Blank optional fields mean "absent", because an empty form field
     * arrives as "" and should clear the value rather than fail validation.
     */
    record ProjectRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 5000) @Nullable String description,
            @HttpUrl @Nullable String url,
            @HttpUrl @Nullable String imageUrl,
            @NotNull @PositiveOrZero Integer displayOrder,
            @Nullable Boolean published) {

        String trimmedTitle() {
            return title.strip();
        }

        @Nullable String presentDescription() {
            return blankToNull(description);
        }

        @Nullable String presentUrl() {
            return blankToNull(url);
        }

        @Nullable String presentImageUrl() {
            return blankToNull(imageUrl);
        }

        /** Omitted means draft, so nothing becomes public unless the admin says so. */
        boolean isPublished() {
            return Boolean.TRUE.equals(published);
        }

        private static @Nullable String blankToNull(@Nullable String value) {
            return value == null || value.isBlank() ? null : value.strip();
        }
    }

    record AdminProject(
            long id,
            String title,
            @Nullable String description,
            @Nullable String url,
            @Nullable String imageUrl,
            int displayOrder,
            boolean published,
            Instant createdAt) {

        static AdminProject from(Project project) {
            return new AdminProject(
                    project.savedId(),
                    project.title(),
                    project.description(),
                    project.url(),
                    project.imageUrl(),
                    project.displayOrder(),
                    project.published(),
                    project.createdAt());
        }
    }

    private final ProjectService service;

    AdminProjectsController(ProjectService service) {
        this.service = service;
    }

    @GetMapping
    List<AdminProject> list() {
        return service.listAll().stream().map(AdminProject::from).toList();
    }

    @PostMapping
    ResponseEntity<AdminProject> create(@Valid @RequestBody ProjectRequest request) {
        Project project = service.create(
                request.trimmedTitle(),
                request.presentDescription(),
                request.presentUrl(),
                request.presentImageUrl(),
                request.displayOrder(),
                request.isPublished());
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(project.savedId())
                .toUri();
        return ResponseEntity.created(location).body(AdminProject.from(project));
    }

    @PutMapping("/{id}")
    AdminProject replace(@PathVariable long id, @Valid @RequestBody ProjectRequest request) {
        return AdminProject.from(service.replace(
                id,
                request.trimmedTitle(),
                request.presentDescription(),
                request.presentUrl(),
                request.presentImageUrl(),
                request.displayOrder(),
                request.isPublished()));
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
