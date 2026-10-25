# syntax=docker/dockerfile:1
#
# Suwa production images (see deploy/aws/README.md).
#
#   app    — the Next.js standalone server only (small; what runs all day)
#   tools  — full repo + tsx + pg_dump/rclone, for one-off and scheduled jobs:
#            db:deploy, clinic:create, seed:templates, backup, restore
#
# Build:  docker build --target app   -t suwa-app   .
#         docker build --target tools -t suwa-tools .
# The build needs NO database and NO secrets; everything comes from the runtime environment.

ARG NODE_IMAGE=node:24-alpine

# ── Dependencies ────────────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ── Build the Next.js standalone server ─────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── app: what serves clinics ────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS app
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S suwa && adduser -S suwa -G suwa
COPY --from=build --chown=suwa:suwa /app/.next/standalone ./
COPY --from=build --chown=suwa:suwa /app/.next/static ./.next/static
USER suwa
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1
CMD ["node", "server.js"]

# ── tools: migrations, provisioning, seeding, backups ───────────────────────────────────────────
# pg_dump must be at least the RDS server's major version: keep postgresqlNN-client in step with
# the RDS engine version you choose (17 here).
FROM ${NODE_IMAGE} AS tools
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache postgresql17-client rclone ca-certificates
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
COPY liquibase/changelog ./liquibase/changelog
# The scripts read .env when present; in containers the environment is passed in instead.
RUN touch .env && mkdir -p backups
CMD ["npm", "run", "db:deploy", "--", "--status"]
