# syntax=docker/dockerfile:1

# Build stage: compile with the Maven wrapper, then split the jar into Spring Boot layers so that a code change
# rebuilds only the small application layer, not the dependencies.
FROM eclipse-temurin:21.0.12.1_1-jdk-alpine-3.24 AS build
WORKDIR /workspace

# Resolve dependencies before copying sources: this layer stays cached until pom.xml changes.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q dependency:go-offline

COPY src/main/ src/main/
# Tests run in CI (they need Docker for Testcontainers); the image build only packages.
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -q -Dmaven.test.skip=true package \
    && cp target/hub-*.jar application.jar \
    && java -Djarmode=tools -jar application.jar extract --layers --destination extracted

# Runtime stage: JRE only, no build tools or sources.
FROM eclipse-temurin:21.0.12.1_1-jre-alpine-3.24

# The base image runs as root. A fixed non-root UID keeps volume ownership predictable across hosts.
# The resume directory is created here so a named volume mounted on it inherits the non-root owner.
RUN addgroup -S -g 10001 hub \
    && adduser -S -D -H -u 10001 -G hub hub \
    && mkdir -p /var/lib/hub/resume \
    && chown hub:hub /var/lib/hub/resume

WORKDIR /app
# Least to most frequently changed, so each layer is reused for as long as possible.
COPY --from=build /workspace/extracted/dependencies/ ./
COPY --from=build /workspace/extracted/spring-boot-loader/ ./
COPY --from=build /workspace/extracted/snapshot-dependencies/ ./
COPY --from=build /workspace/extracted/application/ ./

USER 10001:10001
EXPOSE 8080

# Liveness, not readiness: a database outage should not mark the container unhealthy (see application.yml).
HEALTHCHECK --interval=10s --timeout=3s --start-period=60s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/actuator/health/liveness || exit 1

# Size the heap from the container's memory limit rather than the host's.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "application.jar"]
