#!/bin/sh
set -euo pipefail
: "${API_SERVER:=http://backend:8000}"
: "${CLIENT_MAX_BODY_SIZE:=200m}"
envsubst '${API_SERVER} ${CLIENT_MAX_BODY_SIZE}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec "$@"
