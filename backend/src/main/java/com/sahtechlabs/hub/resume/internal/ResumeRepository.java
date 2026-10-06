package com.sahtechlabs.hub.resume.internal;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;

interface ResumeRepository extends ListCrudRepository<Resume, Long> {

    Optional<Resume> findByActiveTrue();

    /** Newest first; id breaks ties so uploads within the same instant still list in a stable order. */
    List<Resume> findAllByOrderByUploadedAtDescIdDesc();

    @Modifying
    @Query("UPDATE resume SET active = FALSE WHERE active")
    int deactivateAll();
}
