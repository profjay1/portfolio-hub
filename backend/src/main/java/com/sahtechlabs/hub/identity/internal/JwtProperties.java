package com.sahtechlabs.hub.identity.internal;

import java.time.Duration;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * The secret comes only from {@code HUB_JWT_SECRET}. It is checked in {@link TokenService} rather than with Bean
 * Validation on purpose: Boot's startup failure report prints the rejected value, which would put a real (if weak)
 * secret in the logs.
 */
@ConfigurationProperties("hub.jwt")
record JwtProperties(@Nullable String secret, Duration ttl) {

    @Override
    public String toString() {
        return "JwtProperties[secret=****, ttl=" + ttl + "]";
    }
}
