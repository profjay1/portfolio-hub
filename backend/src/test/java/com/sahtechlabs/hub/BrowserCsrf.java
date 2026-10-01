package com.sahtechlabs.hub;

import jakarta.servlet.http.Cookie;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Sends a CSRF token the way the SPA does: the XSRF-TOKEN cookie plus the same value in X-XSRF-TOKEN.
 *
 * <p>Used instead of spring-security-test's {@code csrf()}, which swaps the CsrfFilter's token repository inside the
 * shared application context. That swap leaked into later tests and stopped the real XSRF-TOKEN cookie from being
 * issued, making results depend on test order. This keeps the production CSRF check untouched.
 */
public final class BrowserCsrf {

    private BrowserCsrf() {}

    public static RequestPostProcessor csrfToken() {
        return request -> {
            String token = UUID.randomUUID().toString();
            List<Cookie> cookies = new ArrayList<>(
                    request.getCookies() == null ? List.of() : Arrays.asList(request.getCookies()));
            cookies.add(new Cookie("XSRF-TOKEN", token));
            request.setCookies(cookies.toArray(Cookie[]::new));
            request.addHeader("X-XSRF-TOKEN", token);
            return request;
        };
    }
}
