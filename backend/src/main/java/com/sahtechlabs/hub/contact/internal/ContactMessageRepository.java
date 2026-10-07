package com.sahtechlabs.hub.contact.internal;

import java.util.List;
import org.springframework.data.repository.ListCrudRepository;

interface ContactMessageRepository extends ListCrudRepository<ContactMessage, Long> {

    /** Newest first; id breaks ties so messages sent in the same instant still list in a stable order. */
    List<ContactMessage> findAllByOrderByCreatedAtDescIdDesc();
}
