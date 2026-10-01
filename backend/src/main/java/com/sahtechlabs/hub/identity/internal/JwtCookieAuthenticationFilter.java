package com.sahtechlabs.hub.identity.internal;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Turns a valid session cookie into an authenticated caller. A missing, malformed, tampered or expired cookie is
 * ignored rather than rejected: the request continues anonymously and the authorization rules decide. That keeps a
 * stale cookie from breaking public endpoints, including the login that would replace it.
 *
 * <p>Not a Spring bean on purpose: as a bean, Boot would also register it as a plain servlet filter outside the
 * security chain.
 */
final class JwtCookieAuthenticationFilter extends OncePerRequestFilter {

    private final TokenService tokens;
    private final SecurityContextHolderStrategy contexts = SecurityContextHolder.getContextHolderStrategy();

    JwtCookieAuthenticationFilter(TokenService tokens) {
        this.tokens = tokens;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (contexts.getContext().getAuthentication() == null) {
            SessionCookie.readFrom(request).flatMap(tokens::verify).ifPresent(user -> {
                SecurityContext context = contexts.createEmptyContext();
                context.setAuthentication(
                        UsernamePasswordAuthenticationToken.authenticated(user, null, user.authorities()));
                contexts.setContext(context);
            });
        }
        chain.doFilter(request, response);
    }
}
