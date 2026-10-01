package com.sahtechlabs.hub.identity.internal;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Component;

/** Issues and verifies the HS256-signed session tokens carried in the auth cookie (see docs/adr/0006). */
@Component
@EnableConfigurationProperties(JwtProperties.class)
class TokenService {

    static final String ISSUER = "portfolio-hub";

    /** HS256 needs a key of at least 256 bits. */
    static final int MINIMUM_SECRET_LENGTH = 32;

    private final JwtEncoder encoder;
    private final JwtDecoder decoder;
    private final Clock clock;
    private final Duration ttl;

    TokenService(JwtProperties properties, Clock clock) {
        SecretKey key = new SecretKeySpec(requireStrongSecret(properties.secret()), "HmacSHA256");
        this.encoder = NimbusJwtEncoder.withSecretKey(key).build();

        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        // Expiry is judged by the injected clock with no grace period: one server issues and verifies, so there is no
        // clock skew between machines to absorb.
        JwtTimestampValidator expiry = new JwtTimestampValidator(Duration.ZERO);
        expiry.setClock(clock);
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(expiry, new JwtIssuerValidator(ISSUER)));
        this.decoder = decoder;

        this.clock = clock;
        this.ttl = properties.ttl();
    }

    String issue(User user) {
        Instant now = clock.instant();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .subject(String.valueOf(user.id()))
                .issuedAt(now)
                .expiresAt(now.plus(ttl))
                .claim("email", user.email())
                .claim("role", user.role().name())
                .build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
    }

    /** Empty for anything that is not a well-formed, correctly signed, unexpired token from this app. */
    Optional<AuthenticatedUser> verify(String token) {
        try {
            Jwt jwt = decoder.decode(token);
            return Optional.of(new AuthenticatedUser(
                    Long.parseLong(jwt.getSubject()),
                    jwt.getClaimAsString("email"),
                    Role.valueOf(jwt.getClaimAsString("role"))));
        } catch (JwtException | IllegalArgumentException | NullPointerException invalid) {
            return Optional.empty();
        }
    }

    Duration ttl() {
        return ttl;
    }

    /** Fails startup naming the variable, never echoing its value. */
    private static byte[] requireStrongSecret(@Nullable String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("HUB_JWT_SECRET is not set. It is required to sign session tokens.");
        }
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < MINIMUM_SECRET_LENGTH) {
            throw new IllegalStateException(
                    "HUB_JWT_SECRET must be at least " + MINIMUM_SECRET_LENGTH + " bytes (256 bits) long.");
        }
        return bytes;
    }
}
