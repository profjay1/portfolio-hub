package com.sahtechlabs.hub.identity.internal;

import jakarta.servlet.DispatcherType;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * Deny by default: a request is allowed only if a rule below names it. New public endpoints must be added to the
 * permit-list deliberately; forgetting to do so fails closed (401), never open.
 */
@Configuration(proxyBeanMethods = false)
class SecurityConfiguration {

    /**
     * BCrypt today. Hashes carry an "{id}" prefix, so a stronger algorithm can be adopted later while existing hashes
     * keep verifying.
     */
    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    /**
     * Used only by login. DaoAuthenticationProvider hashes a dummy password when the email is unknown, so response
     * time does not reveal which accounts exist, and it reports both failures as BadCredentialsException.
     */
    @Bean
    AuthenticationManager authenticationManager(UserDetailsService accounts, PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(accounts);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }

    @Bean
    SecurityFilterChain apiSecurity(
            HttpSecurity http,
            TokenService tokens,
            @Qualifier("handlerExceptionResolver") HandlerExceptionResolver exceptionResolver) {
        http
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // The session cookie is an ambient credential, so unsafe requests need a CSRF token as well
                // (double-submit: XSRF-TOKEN cookie echoed in the X-XSRF-TOKEN header, which Angular does natively).
                // SameSite=Strict alone is not enough: it does not stop same-site (sibling subdomain) attackers.
                // See docs/adr/0006.
                .csrf(csrf -> csrf.spa())
                .addFilterAfter(new CsrfCookieFilter(), CsrfFilter.class)
                .addFilterBefore(new JwtCookieAuthenticationFilter(tokens), AnonymousAuthenticationFilter.class)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                // Route 401/403 through the shared @RestControllerAdvice so they are Problem Details like every
                // other error, with the same `code` and correlation id.
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint(
                                (request, response, ex) -> exceptionResolver.resolveException(request, response, null, ex))
                        .accessDeniedHandler(
                                (request, response, ex) -> exceptionResolver.resolveException(request, response, null, ex)))
                .authorizeHttpRequests(requests -> requests
                        // Let the container's error dispatch render errors instead of masking them as 401.
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/ping").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/projects").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/resume/download").permitAll()
                        .requestMatchers(HttpMethod.GET, "/actuator/health", "/actuator/health/**", "/actuator/info")
                                .permitAll()
                        // Logout stays public so an expired session can still clear its cookie.
                        .requestMatchers(HttpMethod.POST, "/api/v1/auth/login", "/api/v1/auth/logout").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/v1/auth/me").authenticated()
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .anyRequest().denyAll());
        return http.build();
    }
}
