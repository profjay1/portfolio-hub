/**
 * Cross-cutting concerns: errors, logging, configuration, audit. Keep this module tiny.
 *
 * <p>This package is the module's public API. Other modules may depend only on types declared here;
 * everything under {@code internal} is private to the module and enforced by Spring Modulith.
 */
@ApplicationModule(displayName = "Shared")
package com.sahtechlabs.hub.shared;

import org.springframework.modulith.ApplicationModule;
