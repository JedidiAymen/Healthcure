# MEDFORGE web: the React app built once, then served as static files.
FROM node:22.16.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.ts tsconfig.json tsconfig.app.json components.json ./
COPY src src
COPY packages packages
# Same-origin API: the proxy routes /api to the API container.
ENV VITE_API_URL=""
RUN npm run build

FROM caddy:2.10.2-alpine
COPY docker/Caddyfile.web /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 8080
