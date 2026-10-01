package com.sahtechlabs.hub;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModule;
import org.springframework.modulith.core.ApplicationModules;

class ModularityTests {

    private final ApplicationModules modules = ApplicationModules.of(HubApplication.class);

    @Test
    void detectsEveryModuleFromTheDocumentedLayout() {
        assertThat(modules.stream().map(ApplicationModule::getIdentifier).map(Object::toString))
                .containsExactlyInAnyOrder("identity", "projects", "resume", "contact", "shared");
    }

    @Test
    void modulesOnlyDependOnEachOthersPublicApi() {
        modules.verify();
    }
}
