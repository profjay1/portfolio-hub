package com.sahtechlabs.hub.identity.internal;

import org.springframework.data.repository.ListCrudRepository;

interface UserRepository extends ListCrudRepository<User, Long> {}
