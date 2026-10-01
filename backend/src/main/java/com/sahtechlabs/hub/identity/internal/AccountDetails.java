package com.sahtechlabs.hub.identity.internal;

import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;

/** Adapts a stored {@link User} to Spring Security's password check at login. */
record AccountDetails(User user) implements UserDetails {

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + user.role().name()));
    }

    @Override
    public String getPassword() {
        return user.passwordHash();
    }

    @Override
    public String getUsername() {
        return user.email();
    }

    @Override
    public String toString() {
        return "AccountDetails[id=" + user.id() + "]";
    }

    @Component
    static class Lookup implements UserDetailsService {

        private final UserRepository users;

        Lookup(UserRepository users) {
            this.users = users;
        }

        @Override
        public UserDetails loadUserByUsername(String email) {
            return users.findByEmail(User.normalise(email))
                    .map(AccountDetails::new)
                    // No email in the message: it would end up in logs, and the caller never sees it anyway.
                    .orElseThrow(() -> new UsernameNotFoundException("No account matches the supplied email"));
        }
    }
}
