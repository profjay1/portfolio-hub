package com.sahtechlabs.hub.projects.internal;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Locale;
import java.util.Set;

/**
 * The one definition of an acceptable project link: absolute, http or https, with a host. These values end up in
 * {@code href} and {@code src} attributes, so other schemes ({@code javascript:}, {@code data:}) are refused outright.
 */
final class HttpUrls {

    /** Matches the VARCHAR(2048) columns. */
    static final int MAX_LENGTH = 2048;

    private static final Set<String> SCHEMES = Set.of("http", "https");

    private HttpUrls() {}

    static boolean isValid(String value) {
        if (value.length() > MAX_LENGTH) {
            return false;
        }
        try {
            URI uri = new URI(value);
            return uri.getScheme() != null
                    && SCHEMES.contains(uri.getScheme().toLowerCase(Locale.ROOT))
                    && uri.getHost() != null;
        } catch (URISyntaxException malformed) {
            return false;
        }
    }
}
