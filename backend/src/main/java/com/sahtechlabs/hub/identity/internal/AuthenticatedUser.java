package com.sahtechlabs.hub.identity.internal;

import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

/** Who a valid session token says the caller is. Built from the token alone, without a database lookup. */
record AuthenticatedUser(long id, String email, Role role) {

    List<GrantedAuthority> authorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }
}
