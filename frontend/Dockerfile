# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build the static SPA ----------
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=${VITE_BASE_PATH}

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY tsconfig.json tsconfig.node.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# ---------- Stage 2: serve via nginx ----------
FROM nginx:1.27-alpine AS runtime

ARG NGINX_CONF=nginx.conf
RUN rm /etc/nginx/conf.d/default.conf
COPY ${NGINX_CONF} /etc/nginx/conf.d/app.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
