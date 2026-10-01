package com.sahtechlabs.hub.identity.internal;

import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Bound from {@code HUB_ADMIN_EMAIL} and {@code HUB_ADMIN_PASSWORD}. Both are optional at bind time on purpose: they
 * are needed only while no user exists, so after the first start the password can be removed from the environment.
 * {@link AdminBootstrap} enforces them when it actually needs them.
 */
@ConfigurationProperties("hub.admin")
record AdminBootstrapProperties(@Nullable String email, @Nullable String password) {

    @Override
    public String toString() {
        // Records print every component by default; never let the password reach a log or an error message.
        return "AdminBootstrapProperties[email=" + email + ", password=" + (password == null ? "null" : "****") + "]";
    }
}
