package com.sahtechlabs.hub.identity.internal;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import java.util.Arrays;
import java.util.Optional;
import org.springframework.http.ResponseCookie;

/**
 * The auth cookie. The {@code __Host-} prefix makes browsers insist on Secure, Path=/ and no Domain attribute, so the
 * cookie can never be set or read by a sibling subdomain.
 */
final class SessionCookie {

    static final String NAME = "__Host-hub_session";

    private SessionCookie() {}

    static ResponseCookie carrying(String token, Duration ttl) {
        return base(token).maxAge(ttl).build();
    }

    /** Same name and attributes with Max-Age=0: the browser deletes the cookie. */
    static ResponseCookie expired() {
        return base("").maxAge(Duration.ZERO).build();
    }

    static Optional<String> readFrom(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return Optional.empty();
        }
        return Arrays.stream(cookies)
                .filter(cookie -> NAME.equals(cookie.getName()))
                .map(Cookie::getValue)
                .filter(value -> !value.isBlank())
                .findFirst();
    }

    private static ResponseCookie.ResponseCookieBuilder base(String value) {
        return ResponseCookie.from(NAME, value).httpOnly(true).secure(true).sameSite("Strict").path("/");
    }
}
