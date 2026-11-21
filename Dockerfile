# syntax=docker/dockerfile:1

FROM docker.io/library/node:24-alpine AS build
WORKDIR /app
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=$VITE_BASE_PATH
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run lint && npm run typecheck && npm run test && npm run build

FROM docker.io/library/nginx:1.29-alpine
# FRAME_ANCESTORS lists the origins allowed to show the app in a frame, space separated. Default: none.
ENV FRAME_ANCESTORS="'none'"
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
