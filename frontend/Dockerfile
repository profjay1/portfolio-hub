# syntax=docker/dockerfile:1

# Build stage: install exactly what package-lock.json pins, then produce the production bundle.
FROM node:22.23.3-alpine3.24 AS build
WORKDIR /workspace

# Install before copying sources: this layer stays cached until the lockfile changes.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY angular.json tsconfig.json tsconfig.app.json ./
COPY public/ public/
COPY src/ src/
RUN npm run build

# Runtime stage: static files plus the /api proxy. The base image already runs as the non-root nginx user (UID 101)
# and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.31.6-alpine3.24

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist/hub/browser/ /usr/share/nginx/html/

EXPOSE 8080

# Checks that nginx serves the SPA shell; it deliberately does not go through /api, so a backend outage does
# not mark the frontend unhealthy.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
