package com.sahtechlabs.hub.identity.internal;

import java.util.Optional;
import org.springframework.data.repository.ListCrudRepository;

interface UserRepository extends ListCrudRepository<User, Long> {

    /** Expects an already normalised email (see {@link User#normalise}). */
    Optional<User> findByEmail(String email);
}
