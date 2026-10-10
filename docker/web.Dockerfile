# MEDFORGE web: the static React build served by Caddy.
# The app is built on the host first (npm run build, also run in CI), so building this image needs
# no package downloads and works on slow or offline networks. Use scripts/docker-build.mjs.
FROM caddy:2.10.2-alpine
COPY docker/Caddyfile.web /etc/caddy/Caddyfile
COPY dist /srv
EXPOSE 8080
