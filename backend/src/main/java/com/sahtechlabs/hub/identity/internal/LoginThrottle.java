package com.sahtechlabs.hub.identity.internal;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Limits password guessing per email: after {@value #MAX_FAILURES} failures within a sliding {@link #WINDOW}, logins
 * for that email are refused before the password is even checked, so a correct password cannot shorten the lockout
 * and the response is no oracle for it.
 *
 * <ul>
 *   <li>Every submitted email is tracked, whether or not an account exists, so the throttle reveals nothing about
 *       which emails are real.
 *   <li>Refused attempts are not counted: the lockout ends {@link #WINDOW} after the failures that caused it, however
 *       often someone retries meanwhile.
 *   <li>A successful login clears the email's failures, so the admin's earlier typos do not linger.
 * </ul>
 *
 * <p>In memory only: state resets when the app restarts, and is per instance. Accepted for one instance on one VPS.
 */
@Component
class LoginThrottle {

    static final int MAX_FAILURES = 5;
    static final Duration WINDOW = Duration.ofMinutes(15);

    /** Above this many tracked emails, stale entries are swept so a spray of random emails cannot grow memory forever. */
    private static final int SWEEP_THRESHOLD = 10_000;

    private static final Logger log = LoggerFactory.getLogger(LoginThrottle.class);

    private final Map<String, List<Instant>> failures = new ConcurrentHashMap<>();
    private final Clock clock;

    LoginThrottle(Clock clock) {
        this.clock = clock;
    }

    /** Throws {@link LoginThrottledException} if the email has used up its failures in the current window. */
    void checkAllowed(String email) {
        if (recent(failures.get(User.normalise(email)), clock.instant()).size() >= MAX_FAILURES) {
            throw new LoginThrottledException();
        }
    }

    void recordFailure(String email) {
        Instant now = clock.instant();
        List<Instant> updated = failures.compute(User.normalise(email), (key, previous) -> {
            List<Instant> stillRecent = new ArrayList<>(recent(previous, now));
            stillRecent.add(now);
            return List.copyOf(stillRecent);
        });
        if (updated.size() == MAX_FAILURES) {
            // No email in the log: it is personal data, and logs are not where an attacker's target list should live.
            log.warn("Login throttling engaged for an account after {} failed attempts", MAX_FAILURES);
        }
        if (failures.size() > SWEEP_THRESHOLD) {
            failures.entrySet().removeIf(entry -> recent(entry.getValue(), now).isEmpty());
        }
    }

    void recordSuccess(String email) {
        failures.remove(User.normalise(email));
    }

    /** A failure counts while it is younger than the window; at exactly {@link #WINDOW} old it has expired. */
    private static List<Instant> recent(@Nullable List<Instant> failedAt, Instant now) {
        if (failedAt == null) {
            return List.of();
        }
        Instant windowStart = now.minus(WINDOW);
        return failedAt.stream().filter(at -> at.isAfter(windowStart)).toList();
    }
}
