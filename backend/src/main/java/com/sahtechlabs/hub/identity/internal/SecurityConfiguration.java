package com.sahtechlabs.hub.identity.internal;

import jakarta.servlet.DispatcherType;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
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

    @Bean
    SecurityFilterChain apiSecurity(
            HttpSecurity http, @Qualifier("handlerExceptionResolver") HandlerExceptionResolver exceptionResolver) {
        http
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // No ambient credentials (cookies, sessions) exist yet, so there is nothing for CSRF to protect.
                // #25 revisits this when the auth cookie arrives (SameSite=Strict, see its ADR).
                .csrf(AbstractHttpConfigurer::disable)
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
                        .requestMatchers(HttpMethod.GET, "/actuator/health", "/actuator/health/**", "/actuator/info")
                                .permitAll()
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .anyRequest().denyAll());
        return http.build();
    }
}
