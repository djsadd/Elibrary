#!/bin/sh
set -euo pipefail
: "${API_SERVER:=http://backend:8000}"
envsubst '${API_SERVER}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec "$@"
