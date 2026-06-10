#!/usr/bin/env bash
# One-time (or re-run) host nginx + optional TLS for quantumflux.cloud/lged
set -euo pipefail

DOMAIN="${DOMAIN:-quantumflux.cloud}"
SITE_NAME="${DOMAIN}"
CONF_SRC="/opt/lged-gis-system/deploy/nginx/${SITE_NAME}.conf"
CONF_DST="/etc/nginx/sites-available/${SITE_NAME}"

echo "==> Installing nginx and certbot..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx

echo "==> Installing site config..."
if [[ ! -f "${CONF_SRC}" ]]; then
  echo "Missing ${CONF_SRC}. Deploy app code first." >&2
  exit 1
fi

cp "${CONF_SRC}" "${CONF_DST}"
ln -sf "${CONF_DST}" "/etc/nginx/sites-enabled/${SITE_NAME}"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl reload nginx

echo "==> Requesting TLS certificate (skips if DNS not pointing here yet)..."
if certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email --redirect 2>/dev/null; then
  echo "HTTPS enabled for ${DOMAIN}"
else
  echo "Certbot skipped or failed — ensure DNS A record for ${DOMAIN} points to this server, then re-run:"
  echo "  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
fi

echo "==> Done. App should be at http://${DOMAIN}/lged/ (or https after certbot)."
