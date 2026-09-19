#!/usr/bin/env sh
# ═══════════════════════════════════════════════════════════════════════════════
#  Lab44 Platform — first-install helper
#
#  Generates a .env with strong random secrets, then brings the whole stack up
#  (Lab44 + PostgreSQL + Guacamole + ownCloud). Re-running it is safe: an
#  existing .env is never overwritten.
#
#  Usage:
#      ./scripts/install.sh                 # generate .env if needed, then start
#      ./scripts/install.sh --no-start      # only generate .env
#      GUACAMOLE_PUBLIC_URL=https://guacamole.example.com \
#      OWNCLOUD_PUBLIC_URL=https://owncloud.example.com \
#      ./scripts/install.sh
#
#  If you do not pass the public URLs, they default to http://<this-host>:<port>,
#  which is fine for a first look and can be edited in .env afterwards.
# ═══════════════════════════════════════════════════════════════════════════════
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
cd "$ROOT_DIR"

ENV_FILE=".env"
COMPOSE_FILE="docker-compose.yml"
START=1

for arg in "$@"; do
  case "$arg" in
    --no-start) START=0 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

log()  { printf '\033[1;34m[lab44]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[lab44]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[lab44]\033[0m %s\n' "$*" >&2; exit 1; }

command -v openssl >/dev/null 2>&1 || die "openssl is required to generate secrets."

# ── Helpers ───────────────────────────────────────────────────────────────────

rand_hex() { openssl rand -hex "$1"; }

# Strip the scheme and any path from a URL, leaving host[:port].
host_of() {
  printf '%s' "$1" | sed -e 's#^[A-Za-z][A-Za-z0-9+.-]*://##' -e 's#/.*$##'
}

# Best-effort detection of this machine's LAN address. Tries progressively
# broader methods, because getting this wrong makes Guacamole and ownCloud links
# point at "localhost" — which then only work on the machine itself.
# Prints nothing if every method fails (caller decides the fallback).
detect_host() {
  ipv4=""

  # 1) Source address of the default route (most accurate).
  if command -v ip >/dev/null 2>&1; then
    ipv4=$(ip route get 1.1.1.1 2>/dev/null \
      | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')
  fi

  # 2) Any global IPv4 the hostname resolves to.
  if [ -z "$ipv4" ] && command -v hostname >/dev/null 2>&1; then
    ipv4=$(hostname -I 2>/dev/null | tr ' ' '\n' \
      | grep -E '^[0-9]{1,3}(\.[0-9]{1,3}){3}$' | grep -v '^127\.' | head -1)
  fi

  # 3) First global IPv4 on any interface.
  if [ -z "$ipv4" ] && command -v ip >/dev/null 2>&1; then
    ipv4=$(ip -4 addr show scope global 2>/dev/null \
      | awk '/inet /{sub(/\/.*/,"",$2); print $2; exit}')
  fi

  printf '%s' "$ipv4"
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  else
    echo ""
  fi
}

# ── 1. Generate .env if it does not exist ─────────────────────────────────────

if [ -f "$ENV_FILE" ]; then
  warn "$ENV_FILE already exists — leaving it untouched."
  warn "Delete it (and the docker volumes) if you really want a clean install."
else
  # Generating fresh secrets while data volumes already exist would leave every
  # database using its OLD password (Postgres/MariaDB only apply the password on
  # first initialisation of their volume). Nothing would be able to authenticate,
  # and the symptom is a confusing "password authentication failed for user".
  if command -v docker >/dev/null 2>&1; then
    EXISTING_VOLUMES=$(docker volume ls --format '{{.Name}}' 2>/dev/null \
      | grep -E '(^|_)lab44_(pgdata|owncloud_db|owncloud_data|guac_schema)$' || true)
  else
    EXISTING_VOLUMES=""
  fi

  if [ -n "$EXISTING_VOLUMES" ] && [ "${LAB44_FORCE_NEW_SECRETS:-}" != "true" ]; then
    printf '\033[1;31m[lab44]\033[0m %s\n' "Refusing to generate new secrets." >&2
    cat >&2 <<EOF

  There is no $ENV_FILE, but these data volumes already exist:

$(printf '      %s\n' $EXISTING_VOLUMES)

  They contain databases created with the OLD passwords, so new secrets would not
  match and every service would fail to authenticate.

  Pick one:

    A) Start clean — DELETES all Lab44/Guacamole/ownCloud data.

       Delete the volumes DIRECTLY (shown with their real names, and this works
       with no $ENV_FILE present — unlike "compose down -v", which cannot even
       parse the compose file until $ENV_FILE exists):

         sudo docker volume rm$(printf ' %s' $EXISTING_VOLUMES)

       …then run the installer again, with the same privileges you are using now:

         sudo ./scripts/install.sh

    B) Keep the existing data — restore your original $ENV_FILE, then re-run.

  If you really mean to generate new secrets anyway (the databases will still
  hold the old passwords, so this is rarely what you want):

         LAB44_FORCE_NEW_SECRETS=true sudo ./scripts/install.sh
EOF
    exit 1
  fi

  HOST_IP=$(detect_host || true)
  if [ -z "${HOST_IP:-}" ]; then
    HOST_IP="localhost"
    warn "Could not detect this machine's LAN IP address."
    warn "Public URLs will fall back to http://localhost:... which only works ON this"
    warn "machine — other devices would get connection errors and, for ownCloud,"
    warn "'untrusted domain' errors. Re-run with the address your users will use:"
    warn "    GUACAMOLE_PUBLIC_URL=http://192.168.1.50:8080 \\"
    warn "    OWNCLOUD_PUBLIC_URL=http://192.168.1.50:8081 ./scripts/install.sh"
  fi

  GUACAMOLE_PUBLIC_URL=${GUACAMOLE_PUBLIC_URL:-"http://${HOST_IP}:8080"}
  OWNCLOUD_PUBLIC_URL=${OWNCLOUD_PUBLIC_URL:-"http://${HOST_IP}:8081"}

  # The bare host:port part of the ownCloud URL.
  OWNCLOUD_PUBLIC_HOST=$(host_of "$OWNCLOUD_PUBLIC_URL")

  # ownCloud rejects any request whose Host header is not in trusted_domains
  # ("You are accessing the server through an untrusted domain").
  #
  # COMMA-separated: the image documents "Multiple domains need to be
  # comma-separated". A space-separated list is treated as ONE bogus domain and
  # then nothing is trusted, so this separator matters.
  #
  #   owncloud / owncloud:8080  → Lab44's own server-to-server OCS calls, which
  #                               run inside the Docker network on port 8080
  #   localhost / 127.0.0.1     → browsing on the machine itself
  #   <ip> / <ip>:<port>        → browsing from other devices
  #
  # Both the bare and port-qualified forms are included because ownCloud
  # versions differ on whether the port is stripped before the comparison.
  OWNCLOUD_TRUSTED_DOMAINS="owncloud,owncloud:8080,localhost,localhost:8081,127.0.0.1,127.0.0.1:8081"
  case "$HOST_IP" in
    localhost|127.*) : ;;
    *) OWNCLOUD_TRUSTED_DOMAINS="$OWNCLOUD_TRUSTED_DOMAINS,${HOST_IP},${HOST_IP}:8081" ;;
  esac
  # Plus whatever the configured public host is (may be a domain name).
  case ",$OWNCLOUD_TRUSTED_DOMAINS," in
    *",${OWNCLOUD_PUBLIC_HOST},"*) : ;;
    *) OWNCLOUD_TRUSTED_DOMAINS="$OWNCLOUD_TRUSTED_DOMAINS,${OWNCLOUD_PUBLIC_HOST}" ;;
  esac

  log "Generating secrets into $ENV_FILE ..."

  # ENCRYPTION_KEY must be exactly 32 bytes of text — `openssl rand -hex 16`
  # yields exactly 32 characters. (A base64-encoded 32-byte value would be 44
  # characters; the app tolerates that but hashes it, so hex is preferred.)
  cat > "$ENV_FILE" <<EOF
# ═══════════════════════════════════════════════════════════════════════════════
#  Lab44 Platform — generated by scripts/install.sh on $(date -u '+%Y-%m-%d %H:%M:%SZ')
#
#  These are real secrets. Keep this file private and back it up: losing
#  SESSION_SECRET logs everyone out, and losing ENCRYPTION_KEY makes the stored
#  Guacamole/ownCloud credentials undecryptable.
# ═══════════════════════════════════════════════════════════════════════════════

# ── Database (PostgreSQL, shared by Lab44 and Guacamole) ─────────────────────
DB_USER=lab44
DB_NAME=lab44
DB_PASSWORD=$(rand_hex 24)
GUAC_DB_NAME=guacamole

# ── Lab44 application secrets ────────────────────────────────────────────────
SESSION_SECRET=$(rand_hex 32)
ENCRYPTION_KEY=$(rand_hex 16)
# Password for the built-in administrator account. Change it after first login
# is not possible (there is no admin UI for it) — set the one you want here.
ADMIN_PASSWORD=$(rand_hex 12)

# ── Apache Guacamole ─────────────────────────────────────────────────────────
GUACAMOLE_VERSION=1.6.0
GUACAMOLE_ADMIN_USERNAME=guacadmin
GUACAMOLE_ADMIN_PASSWORD=$(rand_hex 16)
# Server-side URL (inside the Docker network). Do not change unless you move Guacamole.
GUACAMOLE_INTERNAL_URL=http://guacamole:8080/guacamole
# Browser-facing URL. Point this at your reverse proxy hostname.
GUACAMOLE_PUBLIC_URL=${GUACAMOLE_PUBLIC_URL}

# ── ownCloud ─────────────────────────────────────────────────────────────────
OWNCLOUD_VERSION=10.16.4
OWNCLOUD_ADMIN_USERNAME=admin
OWNCLOUD_ADMIN_PASSWORD=$(rand_hex 16)
OWNCLOUD_DB_ROOT_PASSWORD=$(rand_hex 24)
OWNCLOUD_DB_PASSWORD=$(rand_hex 24)
# Server-side URL (inside the Docker network).
OWNCLOUD_INTERNAL_URL=http://owncloud:8080
# Browser-facing URL, and the bare host ownCloud must trust.
OWNCLOUD_PUBLIC_URL=${OWNCLOUD_PUBLIC_URL}
OWNCLOUD_PUBLIC_HOST=${OWNCLOUD_PUBLIC_HOST}
# Hosts ownCloud accepts. Anything not listed here gets
# "You are accessing the server through an untrusted domain" (HTTP 400).
# Add the address your users type, both with and without the port, then recreate
# the container:  docker compose -f docker-compose.yml up -d --force-recreate owncloud
OWNCLOUD_TRUSTED_DOMAINS=${OWNCLOUD_TRUSTED_DOMAINS}

# ── XCP-ng hypervisor (optional) ─────────────────────────────────────────────
# Leave blank to configure it later in the admin UI (Settings → XCP-ng).
XCPNG_HOST=
XCPNG_USERNAME=
XCPNG_PASSWORD=

# XCP-ng serves its XML-RPC API over HTTPS (port 443) and a default install uses
# a SELF-SIGNED certificate. With verification on, every call fails with
# "unable to verify the first certificate" / "self signed certificate".
#
# Only the literal "false" turns verification off — unset or a typo keeps it ON.
#
# false = accept the host's certificate without validating it (works out of the
#         box; the connection is not protected against a man-in-the-middle)
# true  = validate it (set XCP_CA_CERT below so the private cert is trusted)
XCP_REJECT_UNAUTHORIZED=false

# Preferred alternative to disabling verification: trust the host's certificate.
# Either paste the PEM contents, or — easier in Docker — put the file in ./certs
# on the host and give the path as seen INSIDE the container, then set
# XCP_REJECT_UNAUTHORIZED=true above:
#
#   mkdir -p certs
#   openssl s_client -showcerts -connect <xcpng-host>:443 </dev/null 2>/dev/null \
#     | openssl x509 -outform PEM > certs/xcpng-ca.pem
#   # then in .env:
#   XCP_CA_CERT=/certs/xcpng-ca.pem
#   XCP_REJECT_UNAUTHORIZED=true
XCP_CA_CERT=

# ── Platform options ─────────────────────────────────────────────────────────
# Allow students to create their own accounts.
SIGNUP_ENABLED=false

# Session cookie policy.
#
# In production the session cookie is marked "Secure", which browsers only store
# over HTTPS. They make ONE exception: http://localhost counts as a secure
# context. A LAN address does not — so with a Secure cookie, http://localhost:3000
# works while http://<your-ip>:3000 loads the page but every API call fails with
# "Authentication required." (the cookie is silently dropped).
#
# true  = cookie also sent over plain HTTP  → required while you use http://<ip>:3000
# false = cookie only over HTTPS           → set this once Lab44 is behind HTTPS
ALLOW_INSECURE_COOKIES=true

# Secret for the auto-backup endpoint if called from a scheduler:
#   GET /api/admin/backups/check  with header  x-cron-secret: <value>
CRON_SECRET=$(rand_hex 16)

# ── Published ports / bind addresses ─────────────────────────────────────────
# Bind to 127.0.0.1 instead of 0.0.0.0 if your reverse proxy runs on this host.
APP_BIND=0.0.0.0
APP_PORT=3000
GUACAMOLE_BIND=0.0.0.0
GUACAMOLE_PORT=8080
OWNCLOUD_BIND=0.0.0.0
OWNCLOUD_PORT=8081
EOF

  chmod 600 "$ENV_FILE"
  # Under sudo the file would otherwise be owned by root and unreadable by the
  # person who ran the installer — including by the secret printout below.
  if [ "$(id -u)" = "0" ] && [ -n "${SUDO_USER:-}" ]; then
    chown "$SUDO_USER" "$ENV_FILE" 2>/dev/null || true
  fi
  log "Wrote $ENV_FILE (mode 600)."
fi

# Make sure the person who ran the installer can actually READ .env. Running
# under sudo (or rootful podman, whose userns can leave the file owned by a
# mapped uid such as "nobody") otherwise leaves it unreadable without sudo —
# including by the secret printout below. Applies whether .env was just
# generated or already existed.
if [ "$(id -u)" = "0" ] && [ -n "${SUDO_USER:-}" ] && [ -f "$ENV_FILE" ]; then
  if [ "$(stat -c '%U' "$ENV_FILE" 2>/dev/null || echo '?')" != "$SUDO_USER" ]; then
    chmod 600 "$ENV_FILE" 2>/dev/null || true
    chown "$SUDO_USER" "$ENV_FILE" 2>/dev/null || true
  fi
fi

# ── 2. Start the stack ────────────────────────────────────────────────────────

if [ "$START" -eq 0 ]; then
  log "Skipping startup (--no-start). Start it later with:"
  printf '    docker compose -f %s up -d --build\n' "$COMPOSE_FILE"
  # Print generated passwords even with --no-start so user knows them
  if [ -f "$ENV_FILE" ]; then
    log "Generated secrets from .env:"
    log "  ADMIN_PASSWORD:       $(grep '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2)"
    log "  SESSION_SECRET:       $(grep '^SESSION_SECRET=' "$ENV_FILE" | cut -d= -f2)"
    log "  ENCRYPTION_KEY:       $(grep '^ENCRYPTION_KEY=' "$ENV_FILE" | cut -d= -f2)"
    log "  DB_PASSWORD:          $(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2)"
    log "  GUACAMOLE_ADMIN_PASSWORD: $(grep '^GUACAMOLE_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2)"
    log "  OWNCLOUD_ADMIN_PASSWORD: $(grep '^OWNCLOUD_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2)"
    log "  CRON_SECRET:          $(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2)"
  fi
  exit 0
fi

COMPOSE=$(compose_cmd)
[ -n "$COMPOSE" ] || die "Neither 'docker compose' nor 'docker-compose' was found."

# ── 2. Start the database first, and verify the password authenticates ────────
# Postgres only applies POSTGRES_PASSWORD the first time its volume is created.
# If .env was regenerated after that, every service that connects to the database
# fails with "password authentication failed" — and because pg_isready does not
# authenticate, the container still reports Healthy. Verifying here catches it
# with a clear message before anything else tries to start.
log "Starting the database..."
# shellcheck disable=SC2086
$COMPOSE -f "$COMPOSE_FILE" up -d db

DB_USER_V=$(sed -n 's/^DB_USER=//p' "$ENV_FILE" | head -1); DB_USER_V=${DB_USER_V:-lab44}
DB_NAME_V=$(sed -n 's/^DB_NAME=//p' "$ENV_FILE" | head -1); DB_NAME_V=${DB_NAME_V:-lab44}
DB_PASS_V=$(sed -n 's/^DB_PASSWORD=//p' "$ENV_FILE" | head -1)

if [ -n "$DB_PASS_V" ] && [ "${LAB44_SKIP_DB_CHECK:-}" != "true" ]; then
  # Step 1 — wait for the server to be *reachable*. pg_isready does not
  # authenticate, so this only distinguishes "still starting" from "up"
  # (a first boot runs initdb, which takes a few seconds).
  # Set LAB44_SKIP_DB_CHECK=true to skip this whole preflight if your compose
  # provider does not support `exec`.
  log "Waiting for the database to accept connections..."
  db_ready=0
  exec_usable=1
  empty_streak=0
  i=0
  while [ "$i" -lt 30 ]; do
    # shellcheck disable=SC2086
    ready_out=$($COMPOSE -f "$COMPOSE_FILE" exec -T db \
         pg_isready -U "$DB_USER_V" -d "$DB_NAME_V" 2>/dev/null || true)
    case "$ready_out" in
      *"accepting connections"*) db_ready=1; break ;;
    esac

    # Repeated totally-empty output means `exec` is not running our command at
    # all (some podman-compose versions). Detect that quickly instead of sitting
    # here for the full timeout.
    if [ -z "$ready_out" ]; then
      empty_streak=$((empty_streak + 1))
      if [ "$empty_streak" -ge 5 ]; then
        exec_usable=0
        break
      fi
    else
      empty_streak=0
    fi

    i=$((i + 1))
    sleep 2
  done

  if [ "$exec_usable" -eq 0 ]; then
    warn "'compose exec' produced no output — skipping the database credential check."
    warn "If app-migrate or guac-db-init fail, the Postgres volume probably still"
    warn "holds an older password. Start clean with:"
    warn "    sudo docker volume rm lab44_pgdata lab44_owncloud_db lab44_owncloud_data lab44_guac_schema"
  elif [ "$db_ready" -ne 1 ]; then
    # Do not hard-fail: we cannot distinguish "database still coming up" from
    # "this compose provider's exec does not run the command". A broken preflight
    # must never block an otherwise healthy install.
    warn "Could not confirm the database is accepting connections."
    warn "Continuing anyway — if the services below fail, check:"
    warn "    sudo docker compose -f $COMPOSE_FILE logs db"
  fi

  # Step 2 — a single authentication check (skipped when exec is unusable, since
  # it would just repeat the warning above).
  #
  # Two details matter here, both learned the hard way:
  #
  #   * `-h 127.0.0.1` forces a TCP connection. Without it psql uses the Unix
  #     socket, and the Postgres image ships `local all all trust` — socket
  #     connections are NOT password-checked, so the check would always pass.
  #     The application connects over TCP, which is what must be verified.
  #
  #   * The QUERY RESULT is required, not just a zero exit status: some compose
  #     providers report success for `exec` even when the command failed.
  if [ "$exec_usable" -eq 1 ]; then
  log "Verifying database credentials..."
  # shellcheck disable=SC2086
  auth_out=$($COMPOSE -f "$COMPOSE_FILE" exec -T db \
       sh -c "PGPASSWORD='$DB_PASS_V' psql -h 127.0.0.1 -U '$DB_USER_V' -d '$DB_NAME_V' -tAc 'SELECT 1'" \
       2>/dev/null || true)

  auth_clean=$(printf '%s' "$auth_out" | tr -d '[:space:]')

  if [ "$auth_clean" = "1" ]; then
    log "Database credentials OK."
  elif [ -z "$auth_clean" ]; then
    # No output at all: we cannot tell "wrong password" from "this compose
    # provider's exec does not run the command". Do not claim success, and do not
    # block the install either — just say how to check.
    warn "Could not verify the database credentials: 'exec' produced no output."
    warn "If app-migrate or guac-db-init then fail, the Postgres volume probably"
    warn "still holds an older password. Check it directly with:"
    warn "    sudo docker compose -f $COMPOSE_FILE exec db psql -h 127.0.0.1 -U $DB_USER_V -d $DB_NAME_V -c 'SELECT 1'"
    warn "If that reports an authentication error, start clean by deleting the volumes:"
    warn "    sudo docker volume rm lab44_pgdata lab44_owncloud_db lab44_owncloud_data lab44_guac_schema"
  else
    printf '\033[1;31m[lab44]\033[0m %s\n' "Database authentication FAILED." >&2
    cat >&2 <<EOF

  DB_PASSWORD in $ENV_FILE does not match the password the existing Postgres
  volume was created with.

  This happens when .env is regenerated (or deleted) while the data volumes
  survive — Postgres only applies its password on first initialisation. The
  container still reports "Healthy", because pg_isready does not authenticate,
  so the symptom shows up as failures in app-migrate and guac-db-init instead.

  Either:

    A) Start clean — DELETES all Lab44/Guacamole/ownCloud data. Deleting the
       volumes directly always works, even with no $ENV_FILE present:
         sudo docker volume rm lab44_pgdata lab44_owncloud_db lab44_owncloud_data lab44_guac_schema
         sudo ./scripts/install.sh

    B) Keep the data — put the original DB_PASSWORD back into $ENV_FILE, then:
         sudo docker compose -f $COMPOSE_FILE down
         sudo ./scripts/install.sh
EOF
    exit 1
  fi
  fi
fi

# ── 3. Start the rest of the stack ────────────────────────────────────────────
# --force-recreate is deliberate: podman-compose (and some docker-compose
# versions) will happily leave existing containers running when only their
# config changed, so a fixed healthcheck or command would silently not apply.
log "Building and starting the rest of the stack (this can take several minutes on first run)..."
# shellcheck disable=SC2086
if ! $COMPOSE -f "$COMPOSE_FILE" up -d --build --force-recreate; then
  # Not every compose provider (e.g. some podman-compose versions) accepts
  # --force-recreate. Fall back rather than failing the whole install.
  warn "--force-recreate was rejected; retrying without it."
  # shellcheck disable=SC2086
  $COMPOSE -f "$COMPOSE_FILE" up -d --build
fi

cat <<'EOF'

───────────────────────────────────────────────────────────────────────────────
 Lab44 is starting. Give it a minute on first boot — it has to create the
 Lab44 schema, the Guacamole schema and install ownCloud.

 Check progress:
     docker compose -f docker-composeV2.yml ps
     docker compose -f docker-composeV2.yml logs -f app

 Then open the app and log in as administrator with the password in .env
 (ADMIN_PASSWORD).

 Already configured automatically for you:
   • Guacamole URL + admin credentials
   • ownCloud URL + admin credentials
   • the Guacamole admin password (no more default guacadmin/guacadmin)
 All of it can be changed later in the admin UI — or in .env plus a restart.

 Still worth doing:
   1. Log in to Guacamole once and confirm it works.
   2. Log in to ownCloud once and confirm it works.
   3. Set the XCP-ng host/credentials (admin UI, or .env + restart).
   4. Back up .env — losing ENCRYPTION_KEY makes stored credentials unreadable.
EOF

  # Print generated secrets from .env
  log "Generated secrets (save .env — losing these makes recovery impossible):"
  log "  ADMIN_PASSWORD:       $(grep '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2)"
  log "  SESSION_SECRET:       $(grep '^SESSION_SECRET=' "$ENV_FILE" | cut -d= -f2)"
  log "  ENCRYPTION_KEY:       $(grep '^ENCRYPTION_KEY=' "$ENV_FILE" | cut -d= -f2)"
  log "  DB_PASSWORD:          $(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2)"
  log "  GUACAMOLE_ADMIN_PASSWORD: $(grep '^GUACAMOLE_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2)"
  log "  OWNCLOUD_ADMIN_PASSWORD: $(grep '^OWNCLOUD_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2)"
  log "  CRON_SECRET:          $(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2)"
