package com.sahtechlabs.hub.projects.internal;

import java.util.List;
import org.springframework.data.repository.ListCrudRepository;

/** Both listings break displayOrder ties by id, so equal positions still come back in a stable order. */
interface ProjectRepository extends ListCrudRepository<Project, Long> {

    List<Project> findByPublishedTrueOrderByDisplayOrderAscIdAsc();

    List<Project> findAllByOrderByDisplayOrderAscIdAsc();
}
