package com.sahtechlabs.hub.shared.internal;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Lets the frontend show that the backend is up and which version it runs, without exposing actuator details. */
@RestController
class PingController {

    record Ping(String status, String version) {}

    private final Ping ping;

    PingController(ObjectProvider<BuildProperties> buildProperties) {
        // BuildProperties exists only when Maven's build-info goal ran; an IDE run without it still answers.
        BuildProperties build = buildProperties.getIfAvailable();
        this.ping = new Ping("ok", build != null ? build.getVersion() : "unknown");
    }

    @GetMapping("/api/v1/ping")
    Ping ping() {
        return ping;
    }
}
