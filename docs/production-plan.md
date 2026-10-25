# Production Plan — AWS + Tailscale

**Status:** chosen direction, 2026-10-25. The pilot runs on one clinic PC
([runbook.md](runbook.md)). Production runs on **AWS (Mumbai, `ap-south-1`)** with the app
reachable **only over a private Tailscale network** — no public endpoint. Step-by-step setup:
[deploy/aws/README.md](../deploy/aws/README.md).

## 1. Why not keep installing on the clinic's PC

| Problem on a clinic PC | Consequence |
|------------------------|-------------|
| One machine holds the app, the database and the only live copy of the data | Disk failure, theft or ransomware stops the clinic and risks data loss |
| Backups depend on that PC being on and correctly configured | Silent backup failures, found only when a restore is needed |
| Every update needs someone on site | Each new customer adds manual ops; versions drift |
| No remote access | Owner/doctor can't view or verify reports away from the clinic |
| Patching, disk encryption, restarts are the clinic's job | Clinical + financial data on an unmanaged machine |
| A new clinic = a new install, database and backup setup | Doesn't scale past a handful of customers |

## 2. Target architecture

```
 Clinic front-desk PCs ─┐  (Tailscale, tagged per clinic)
 Owner phone / laptop  ─┼──── Tailscale network (WireGuard, private) ────┐
 You (admin)           ─┘                                                │
                                                                         ▼
 AWS ap-south-1 (Mumbai) — VPC, private subnets, NO public ingress
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │ EC2 (Docker Compose)                                                        │
 │   tailscale  ── HTTPS on https://suwa.<tailnet>.ts.net (auto TLS cert)      │
 │      └─► app (Next.js standalone, port 3000, not exposed)                   │
 │   backup (nightly: pg_dump → AES-256-GCM → S3)                              │
 │                                   │ TLS                                     │
 │ RDS PostgreSQL (private, encrypted, automated backups + PITR) ◄─────────────┘
 └─────────────────────────────────────────────────────────────────────────────┘
 S3 bucket (versioned, separate account recommended) ◄── encrypted nightly dumps
```

- **No public endpoint.** The EC2 instance has no inbound security-group rules; it makes only
  outbound connections (Tailscale, AWS APIs). RDS accepts connections only from the instance.
- **Two locks:** a device must be approved on the tailnet **and** the person must log in to Suwa.
- **One app, one database, many clinics.** Data isolation is Suwa's `clinic_id` scoping
  (Tailscale controls *who can reach* the app, not *which clinic's data* they see).
- **Admin access** over Tailscale SSH or AWS SSM Session Manager. Port 22 is never opened.
- **HTTPS** comes from `tailscale serve` with an automatic certificate for the `ts.net` name,
  which the app's `secure` session cookie requires.

## 3. Code changes (done)

| # | Change | Where |
|---|--------|-------|
| 1 | **Pinned time zone** — every date calculation uses `APP_TIMEZONE` (default `Asia/Colombo`), not the server clock; AWS servers run on UTC | `src/lib/time.ts`, used by i18n formatters, visits, dashboard, revenue, reports |
| 2 | **Login rate limiting** — failed sign-ins tracked in the database (works across instances): 5 failures per email or 20 per IP within 15 minutes blocks further tries for 15 minutes | `src/lib/auth/rate-limit.ts`, migration `006-login-attempts.sql` |
| 3 | **Multi-clinic provisioning** — `npm run clinic:create` adds a clinic + owner to a shared database; `seed:templates` / `seed:demo` take `--clinic "<name>"` | `scripts/` |
| 4 | **Database connects on first use** — the Docker image builds without a database | `src/lib/db/client.ts` |
| 5 | **Health check** — `GET /api/health` (checks the database) for uptime monitoring | `src/app/api/health/route.ts` |
| 6 | **Deployment files** — Dockerfile, Compose stack (app + Tailscale + backup), Tailscale serve config, ACL policy, nightly backup timer | `Dockerfile`, `deploy/aws/` |

## 4. Remaining before onboarding a second clinic

- **Audit log viewer** for owners (every change is recorded; there's no screen yet).
- **Session revocation** — sessions are 8-hour signed cookies; add a per-user session version so
  removing a staff member takes effect immediately.
- **CI/CD** — GitHub Actions: typecheck, lint, unit + integration tests (Postgres service), build
  and push the image, deploy to staging, promote to production.
- **Tenant-isolation tests** that attempt cross-clinic access through each route.
- **Per-clinic time zone** if a clinic outside Sri Lanka ever joins (today one `APP_TIMEZONE`).
- **Owner-initiated password reset** for staff.

## 5. Tailscale access rules

`deploy/aws/tailscale-policy.hujson` is the starting policy:

- `tag:suwa-app` — the EC2 instance (joined with a tagged, pre-approved auth key).
- `tag:clinic-<name>` — each clinic's front-desk PCs, joined with a **tagged auth key** (so no
  staff member's personal login owns them, and nothing breaks when staff leave).
- Clinic devices may reach **only** `tag:suwa-app:443`. Admins (`group:admins`) reach everything.
- Device approval on; key expiry off for tagged servers, on for personal devices.
- **Never enable Funnel** (it would make the app public).

If a clinic's router blocks Tailscale's direct (UDP) connections, traffic goes through Tailscale
relays — slower, still works. Already-connected devices keep working during a brief Tailscale
coordination outage; new devices wait. Headscale (self-hosted) is the exit if independence from
Tailscale's service is ever needed.

## 6. Backups and recovery

| Layer | What | Target |
|-------|------|--------|
| RDS automated backups + point-in-time recovery | Restore to any second in the retention window | Data loss ≤ 5 min |
| Nightly `npm run backup` → S3 | AES-256-GCM encrypted `pg_dump`, versioned bucket, lifecycle ≥ 30 days, ideally a separate AWS account | Survives an RDS/account mistake |
| Restore drill | Restore a nightly dump into a throwaway database, check counts | Quarterly, and before go-live |

Recovery time target: ≤ 4 hours (new instance from the Compose stack + restore).
`BACKUP_ENCRYPTION_KEY` lives in AWS Secrets Manager **and** offline outside AWS.

## 7. At the clinic

- Reliable internet with a **4G backup router**; agree a paper fallback for outages.
- **Tailscale installed on each front-desk PC** (tagged auth key, unattended mode on Windows),
  and on the owner's phone if remote access is wanted.
- A4 printer for reports/invoices; 80 mm receipt printer; print at 100%.
- One Suwa account per person, invited by the owner.

## 8. Data protection

Health data is special-category personal data under Sri Lanka's **Personal Data Protection Act,
No. 9 of 2022**. Before go-live get a short legal review covering: controller (clinic) vs
processor (Suwa) roles and a **data processing agreement** with each clinic; hosting in Mumbai
(outside Sri Lanka) and its basis; breach notification; retention and deletion. Technical side:
encryption in transit (Tailscale + HTTPS) and at rest (RDS, S3, encrypted dumps), MFA on AWS and
Tailscale admin accounts, least-privilege IAM, CloudTrail on.

## 9. Moving the pilot clinic

1. Stand up **staging** (same stack, separate RDS) and restore a copy of the pilot data; the
   clinic tests a day's workflow on it.
2. Agree a cutover time outside clinic hours; stop the app on the clinic PC.
3. Final `npm run backup` on the PC → restore into production RDS → `npm run db:deploy` →
   `npm run seed:templates -- --clinic "<clinic name>"`.
4. Check record counts (patients, reports, bills, payments); open a few PDFs.
5. Install Tailscale on the front-desk PCs; staff sign in at `https://suwa.<tailnet>.ts.net`
   with their existing passwords.
6. Keep the clinic PC's database read-only for 30 days, then wipe it securely.

## 10. Rollout

| Phase | Work | Rough duration |
|-------|------|----------------|
| 1. AWS + Tailscale | Accounts, VPC, RDS, EC2, Compose stack, S3, policy (deploy/aws/README.md) | 2–3 days |
| 2. Staging rehearsal | Restore pilot data, restore drill, clinic tries it | 1 week |
| 3. Cutover | §9 | 1 day + 30-day fallback |
| 4. Hardening | §4 items before a second clinic | 1–2 weeks |

## 11. Decisions still needed

1. Tailscale plan (number of users/devices across clinics) and who owns the tailnet.
2. Whether Mumbai hosting is acceptable to the clinics (legal review).
3. Separate AWS account for backups (recommended) — yes/no.
4. Pricing for clinics, which sets the hosting/support budget.
