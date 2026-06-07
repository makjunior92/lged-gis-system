# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build the static SPA ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps first for better layer caching.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source and build.
COPY tsconfig.json tsconfig.node.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# ---------- Stage 2: serve via nginx ----------
FROM nginx:1.27-alpine AS runtime

# Drop default site config; add ours which serves the SPA and proxies /api.
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf

COPY --from=builder /app/dist /usr/share/nginx/html

# Non-root: nginx alpine image already runs the master as root and workers as nginx user;
# we keep that default since binding to :80 needs root inside the container, which is fine
# because the container is the security boundary.

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
