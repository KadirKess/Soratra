#!/usr/bin/env bash
# The HTTPS overlay in production mode (no test overlay, so rate limits are
# real), with the optional settings an operator might set. DOMAIN=localhost
# makes Caddy use its own local certificate authority. Needs ports 80 and 443.
source "$(dirname "$0")/lib.sh"

source_url=https://example.org/soratra-source.tar.gz
expires=$(node -e "process.stdout.write(new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10) + 'T00:00:00.000Z')")
new_install caddy 3204 compose.yaml:compose.caddy.yaml \
  DOMAIN=localhost \
  SEARCH_INDEXING=true \
  SOURCE_CODE_URL=$source_url \
  SECURITY_CONTACT=mailto:security@example.org \
  SECURITY_EXPIRES=$expires
up caddy

log 'Waiting for the local certificate'
ca="$SCENARIO_ROOT/caddy-root.crt"
for _ in $(seq 1 30); do
  at caddy docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt "$ca" 2> /dev/null && break
  sleep 2
done
[ -s "$ca" ] || fail 'Caddy made no local certificate authority'
site=https://localhost
get() { curl --silent --show-error --cacert "$ca" "$@"; }
for _ in $(seq 1 30); do
  get --fail "$site/api/health" > /dev/null 2>&1 && break
  sleep 2
done
get --fail "$site/api/health" | grep -q '"ok"' || fail 'not healthy over HTTPS'

log 'Plain HTTP redirects to HTTPS'
location=$(curl --silent --output /dev/null --write-out '%{redirect_url}' http://localhost/signin)
[ "$location" = "$site/signin" ] || fail "HTTP redirected to '$location'"

log 'Setup and sign-in through the proxy'
# A browser sends Origin; behind the proxy it must still match.
status=$(get --output /dev/null --write-out '%{http_code}' -H "Origin: $site" -H 'Content-Type: application/json' \
  --data '{"username":"caddy_host","password":"caddy-host-password","timezone":"UTC","registration":"invite"}' \
  "$site/api/setup")
[ "$status" = 201 ] || fail "setup over HTTPS returned $status"
jar="$SCENARIO_ROOT/cookies.txt"
csrf=$(get --cookie-jar "$jar" "$site/api/auth/csrf" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).csrfToken))")
location=$(get --cookie "$jar" --cookie-jar "$jar" --output /dev/null --write-out '%{redirect_url}' \
  --data-urlencode username=caddy_host --data-urlencode password=caddy-host-password \
  --data-urlencode "csrfToken=$csrf" --data-urlencode "callbackUrl=$site/" \
  "$site/api/auth/callback/credentials")
case "$location" in *error*) fail "sign-in redirected to $location" ;; esac
grep -q '__Secure-authjs.session-token' "$jar" || fail 'no secure session cookie over HTTPS'
[ "$(get --cookie "$jar" --output /dev/null --write-out '%{http_code}' "$site/api/profile/export")" = 200 ] \
  || fail 'signed-in export failed over HTTPS'

log 'Operator settings from .env'
get --fail "$site/robots.txt" | grep -qx "Sitemap: $site/sitemap.xml" || fail 'robots.txt does not use SITE_URL'
headers=$(get --fail --dump-header - --output /dev/null "$site/landing")
if printf '%s' "$headers" | grep -qi '^x-robots-tag:'; then fail 'SEARCH_INDEXING=true still sends X-Robots-Tag'; fi
get --fail "$site/landing" | grep -q '<meta name="robots" content="index, follow"' || fail 'landing page is not indexable'
get --fail "$site/about" | grep -qF "$source_url" || fail 'about page does not link SOURCE_CODE_URL'
security=$(get --fail "$site/.well-known/security.txt")
printf '%s\n' "$security" | grep -qx 'Contact: mailto:security@example.org' || fail "security.txt contact: $security"
printf '%s\n' "$security" | grep -qx "Expires: $expires" || fail "security.txt expiry: $security"

log 'Rate limits use the address Caddy saw, not one the client claims'
# Each attempt claims a different address. Caddy overwrites X-Real-IP, so all
# of them land in one bucket and the sixth is refused.
for i in 1 2 3 4 5 6; do
  status=$(get --output /dev/null --write-out '%{http_code}' -H "X-Real-IP: 203.0.113.$i" \
    -H 'Content-Type: application/json' --data '{}' "$site/api/auth/register")
  if [ "$i" -le 5 ]; then
    [ "$status" != 429 ] || fail "attempt $i was already limited"
  else
    [ "$status" = 429 ] || fail "attempt $i returned $status, not 429"
  fi
done
keys=$(at caddy docker compose exec -T db psql -U soratra -d soratra -tAc \
  "select key from rate_limit_buckets where key like 'register:ip:%'")
[ "$(printf '%s\n' "$keys" | grep -c .)" = 1 ] || fail "expected one register bucket, got: $keys"
# 'unknown' would mean the app ignored TRUSTED_PROXY_IP_HEADER altogether.
[ "$keys" != "register:ip:$(sha256 unknown)" ] || fail 'the app did not use X-Real-IP'
[ "$keys" != "register:ip:$(sha256 203.0.113.1)" ] || fail 'a client-claimed address reached the app'

log 'Caddy scenario passed'
