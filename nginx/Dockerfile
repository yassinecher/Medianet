FROM nginx:1.25-alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom config
COPY nginx.conf /etc/nginx/nginx.conf

# Create cert directory (mount real certs at runtime)
RUN mkdir -p /etc/nginx/certs

# Create self-signed cert for local dev (overridden in prod with real certs)
RUN apk add --no-cache openssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/nginx/certs/privkey.pem \
      -out /etc/nginx/certs/fullchain.pem \
      -subj "/C=DZ/ST=Alger/L=Alger/O=Medianet/CN=localhost" && \
    apk del openssl

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1
