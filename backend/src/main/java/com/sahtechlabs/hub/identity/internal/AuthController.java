package com.sahtechlabs.hub.identity.internal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
class AuthController {

    record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {

        @Override
        public String toString() {
            return "LoginRequest[email=****, password=****]";
        }
    }

    record CurrentUser(String email, Role role) {}

    private final AuthenticationManager authenticationManager;
    private final TokenService tokens;
    private final LoginThrottle throttle;

    AuthController(AuthenticationManager authenticationManager, TokenService tokens, LoginThrottle throttle) {
        this.authenticationManager = authenticationManager;
        this.tokens = tokens;
        this.throttle = throttle;
    }

    /**
     * A wrong password and an unknown email both surface as BadCredentialsException, so the response is identical;
     * the shared advice turns it into 401 {@code invalid-credentials}. Repeated failures for one email lead to 429
     * {@code too-many-attempts} (see {@link LoginThrottle}).
     */
    @PostMapping("/login")
    ResponseEntity<CurrentUser> login(@Valid @RequestBody LoginRequest request) {
        // Before the password check, so a throttled attempt learns nothing about the password.
        throttle.checkAllowed(request.email());
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(request.email(), request.password()));
        } catch (BadCredentialsException failed) {
            throttle.recordFailure(request.email());
            throw failed;
        }
        throttle.recordSuccess(request.email());
        User user = ((AccountDetails) authentication.getPrincipal()).user();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, SessionCookie.carrying(tokens.issue(user), tokens.ttl()).toString())
                .body(new CurrentUser(user.email(), user.role()));
    }

    /**
     * Deletes the cookie in this browser. The token itself stays valid until it expires (stateless; see ADR 0006).
     */
    @PostMapping("/logout")
    ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, SessionCookie.expired().toString()).build();
    }

    @GetMapping("/me")
    CurrentUser me(@AuthenticationPrincipal AuthenticatedUser user) {
        return new CurrentUser(user.email(), user.role());
    }
}
