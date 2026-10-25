# Deploying Suwa on AWS with Tailscale

Production setup for the plan in [docs/production-plan.md](../../docs/production-plan.md):
one EC2 instance running the app in Docker, an RDS PostgreSQL database, nightly encrypted
backups to S3, and **no public endpoint** — clinics reach the app only over Tailscale at
`https://suwa.<your-tailnet>.ts.net`.

| File | What it is |
|------|------------|
| `../../Dockerfile` | `app` image (Next.js standalone server) and `tools` image (migrations, seeding, backups) |
| `docker-compose.yml` | `tailscale` (HTTPS front door) + `app` + on-demand `tools` |
| `tailscale/serve.json` | Tailscale serve: HTTPS on 443 → app on 127.0.0.1:3000, Funnel off |
| `tailscale-policy.hujson` | Access rules: clinic PCs → app:443 only; admins → everything |
| `.env.example` | Production environment (copy to `.env` on the instance) |
| `systemd/suwa-backup.{service,timer}` | Nightly backup at 01:30 Sri Lanka time |

Commands below use the AWS console names; everything can equally be done with Terraform/CDK.
Region throughout: **ap-south-1 (Mumbai)**.

---

## 1. Tailscale (once)

1. Create the tailnet (or use yours). Enable **MagicDNS** and **HTTPS certificates**
   (DNS settings).
2. Paste `tailscale-policy.hujson` into **Access controls**; set `group:admins` to your login(s).
3. **Settings → Device management:** turn on **device approval**.
4. Create an **auth key** for the server: tagged `tag:suwa-app`, pre-approved, not reusable.
   Keep it for step 4.
5. For each clinic, create a **reusable, tagged** key (`tag:clinic-<name>`, pre-approved). It's
   used to join that clinic's front-desk PCs (§7). Never enable **Funnel**.

## 2. Network and database

1. **VPC** with two private subnets (and NAT, or VPC endpoints for SSM/S3/ECR) — the instance
   needs outbound internet for Tailscale but no inbound access.
2. **Security groups**
   - `suwa-app`: **no inbound rules**. Outbound: all.
   - `suwa-db`: inbound TCP 5432 **from `suwa-app` only**.
3. **RDS PostgreSQL 17**, private subnets, `suwa-db` security group, storage encrypted,
   automated backups (≥ 7 days, PITR on), deletion protection on, not publicly accessible.
   Create database `suwa` and a `suwa` user with a strong password.
   (Keep the major version in step with `postgresql17-client` in the `tools` image.)

## 3. Backups bucket and instance role

1. **S3 bucket** `<name>-suwa-backups`: block all public access, **versioning on**, default
   encryption on, lifecycle rule to expire noncurrent/old objects after 30–90 days.
   Better still: put it in a **separate AWS account** and grant the role below write access.
2. **IAM role** for the instance (`suwa-ec2`):
   - `AmazonSSMManagedInstanceCore` (shell access via Session Manager — no SSH).
   - S3: `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` on the backups bucket only.
   - Optional: `secretsmanager:GetSecretValue` on the Suwa secret, ECR pull.

## 4. The instance

1. Launch **EC2** (Amazon Linux 2023, e.g. `t3.small`/`t4g.small` to start), private subnet,
   `suwa-app` security group, role `suwa-ec2`, **no key pair**, encrypted EBS.
   Set **IMDSv2 required, hop limit 2** (so the backup container can use the instance role).
2. Connect with **Session Manager** and install Docker + Compose:

   ```bash
   sudo dnf install -y docker git
   sudo systemctl enable --now docker
   sudo mkdir -p /usr/local/lib/docker/cli-plugins
   sudo curl -sSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
     -o /usr/local/lib/docker/cli-plugins/docker-compose
   sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
   ```

3. Get the code and configure:

   ```bash
   sudo git clone https://github.com/<you>/Suwa.git /opt/suwa
   cd /opt/suwa/deploy/aws
   sudo cp .env.example .env && sudo chmod 600 .env
   sudo vi .env        # DATABASE_URL, SESSION_SECRET, BACKUP_ENCRYPTION_KEY, TS_AUTHKEY, bucket
   ```

   Generate secrets with `openssl rand -base64 48`. Store `BACKUP_ENCRYPTION_KEY` in Secrets
   Manager **and** offline outside AWS.

4. Build and start:

   ```bash
   sudo docker compose build                  # app + tools images (no database needed)
   sudo docker compose up -d                  # tailscale + app
   sudo docker compose logs -f tailscale      # wait for "serve" to start; device appears in the console
   ```

## 5. Database schema and the first clinic

```bash
cd /opt/suwa/deploy/aws
sudo docker compose --profile tools run --rm tools npm run db:deploy
sudo docker compose --profile tools run --rm tools npm run clinic:create -- \
  --clinic "Unawatuna Medical Centre" --name "Owner Name" --email owner@clinic.lk --password "a-strong-password"
sudo docker compose --profile tools run --rm tools npm run seed:templates -- --clinic "Unawatuna Medical Centre"
```

Moving the pilot clinic instead of starting fresh: see §9 below.

Check it: from a device on the tailnet open `https://suwa.<tailnet>.ts.net` → sign-in page, and
`https://suwa.<tailnet>.ts.net/api/health` → `{"status":"ok"}`.

## 6. Nightly backups

```bash
sudo cp /opt/suwa/deploy/aws/systemd/suwa-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now suwa-backup.timer
sudo systemctl start suwa-backup.service      # run once now
journalctl -u suwa-backup.service -n 50       # check it; a .dump.enc must appear in the bucket
```

**Restore drill (before go-live, then quarterly)** — into a throwaway database, never the live one:

```bash
# create database suwa_restore_test on RDS (psql from the tools container), then:
sudo docker compose --profile tools run --rm tools npm run restore -- \
  --from-remote <file>.dump.enc --database-url "postgresql://suwa:...@<rds-host>:5432/suwa_restore_test?sslmode=require" --yes
# compare row counts, then drop suwa_restore_test
```

## 7. Onboarding a clinic

1. `clinic:create` + `seed:templates -- --clinic "<name>"` (§5).
2. Add `tag:clinic-<name>` to the policy and an accept rule to `tag:suwa-app:443`.
3. On each front-desk PC (Windows): install Tailscale, then in an admin PowerShell
   `tailscale up --authkey <clinic key> --unattended` (unattended keeps it connected when nobody
   is signed in to Windows).
4. Bookmark `https://suwa.<tailnet>.ts.net`; set up the A4 and 80 mm printers (print at 100%).
5. The owner signs in, fills in **Settings** (address, phone, footer text), invites staff from **Team**.

## 8. Updating

```bash
cd /opt/suwa && sudo git pull
cd deploy/aws
sudo systemctl start suwa-backup.service                          # back up first
sudo docker compose build
sudo docker compose --profile tools run --rm tools npm run db:deploy
sudo docker compose up -d                                          # restarts the app on the new image
sudo docker compose --profile tools run --rm tools npm run seed:templates -- --all-clinics
```

## 9. Moving the pilot clinic off its PC

1. On the clinic PC: stop the app, `npm run backup` (final dump), copy the `.dump.enc` to the
   bucket (or `rclone copy`). The pilot's `BACKUP_ENCRYPTION_KEY` is needed to restore it.
2. Restore into the (empty) production database with the `tools` container, passing the pilot's
   key:
   ```bash
   sudo docker compose --profile tools run --rm -e BACKUP_ENCRYPTION_KEY="<pilot key>" tools \
     npm run restore -- --from-remote <file>.dump.enc --yes
   ```
3. `npm run db:deploy`, then `npm run seed:templates -- --clinic "<pilot clinic name>"`.
4. Check counts (patients, reports, bills, payments) and open a few PDFs.
5. Install Tailscale on the clinic PCs (§7); staff sign in with their existing passwords.
6. Keep the old PC's database read-only for 30 days, then wipe it.

## Operations notes

- **No inbound ports.** If you ever need one, something is wrong — use Tailscale or SSM.
- **Times:** `APP_TIMEZONE=Asia/Colombo` drives every date in the app; the instance clock stays UTC.
- **Health:** `/api/health` (200 = app + database OK). Point an uptime check at it from a tailnet
  device, or alarm on the container healthcheck.
- **Logs:** `docker compose logs app`; ship to CloudWatch with the awslogs driver if wanted.
- **Scaling later:** a second app instance (another EC2 with the same stack) works as-is —
  sessions are stateless and sign-in rate limits are stored in the database.
