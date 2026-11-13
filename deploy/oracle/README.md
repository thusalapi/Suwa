# Deploying the Suwa pilot on Oracle Cloud (Always Free) with Tailscale

A zero-cost setup for the **pilot clinic**: one ARM server runs everything — Tailscale, the app
and PostgreSQL — with nightly encrypted backups copied off the server. There is **no public
endpoint**; the clinic reaches the app only over Tailscale at `https://suwa.<your-tailnet>.ts.net`.

The same files work on any small Linux VM (2 GB+ memory, x86 or ARM); only §2 is Oracle-specific.
For several clinics, or when a day of data loss is not acceptable, move to the managed-database
setup in [deploy/aws](../aws/README.md).

| File | What it is |
|------|------------|
| `docker-compose.yml` | `tailscale` (HTTPS front door) + `app` + `db` (PostgreSQL 17) + on-demand `tools` |
| `.env.example` | Environment (copy to `.env` on the server) |
| `systemd/suwa-backup.{service,timer}` | Nightly backup at 01:30 Sri Lanka time |
| `../aws/tailscale/serve.json` | Tailscale serve: HTTPS on 443 → app on 127.0.0.1:3000, Funnel off (shared) |
| `../aws/tailscale-policy.hujson` | Access rules: clinic PCs → app:443 only; admins → everything (shared) |

## What "free" costs you

- **One server, one disk.** If it is lost, you restore last night's backup: up to a day of entries
  can be lost. The off-site backup (§5) and a tested restore are not optional.
- **Oracle can reclaim idle Always Free servers** and has closed free accounts with little notice.
  Upgrading the account to Pay As You Go keeps Always Free resources free and, as far as we know,
  exempts them from idle reclamation — check Oracle's current terms.
- **Capacity.** Free ARM servers are often "out of capacity" in a region; retry, or pick another
  availability domain.

---

## 1. Tailscale (once)

1. Create the tailnet (or use yours). Enable **MagicDNS** and **HTTPS certificates** (DNS settings).
2. Paste `../aws/tailscale-policy.hujson` into **Access controls**; set `group:admins` to your login(s).
3. **Settings → Device management:** turn on **device approval**.
4. Create an **auth key** for the server: tagged `tag:suwa-app`, pre-approved, not reusable.
5. Create a **reusable, tagged** key for the clinic (`tag:clinic-unawatuna`, pre-approved) for its
   front-desk PCs (§6). Never enable **Funnel**.

## 2. The server (Oracle Cloud)

1. Sign up at oracle.com/cloud/free. Choose a **home region** near Sri Lanka (Mumbai, Hyderabad or
   Singapore) — it cannot be changed later, and Always Free resources exist only there.
2. **Compute → Instances → Create instance**
   - Image: **Ubuntu 24.04** (aarch64).
   - Shape: **VM.Standard.A1.Flex** (Ampere), **2 OCPU / 12 GB** (Always Free allows up to 4 / 24).
   - Networking: the default VCN with a public subnet and a public IPv4 address (needed for
     outbound internet; nothing will listen on it).
   - SSH key: upload your public key. Boot volume: 50 GB.
3. **Lock down the network.** In the subnet's **security list**, change the SSH rule (TCP 22) from
   `0.0.0.0/0` to **your own IP address only**. Add no other ingress rules — the app needs none.
4. SSH in (`ssh ubuntu@<public-ip>`) and install Docker:

   ```bash
   sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 git
   sudo systemctl enable --now docker
   ```

## 3. Code, configuration, first start

```bash
sudo git clone https://github.com/<you>/Suwa.git /opt/suwa     # private repo: use a deploy key or token
cd /opt/suwa/deploy/oracle
sudo cp .env.example .env && sudo chmod 600 .env
sudo nano .env      # POSTGRES_PASSWORD, SESSION_SECRET, TS_AUTHKEY, BACKUP_ENCRYPTION_KEY, backup remote
```

Generate secrets on the server: `openssl rand -hex 24` (database password) and
`openssl rand -base64 48` (session secret, backup key). Write `BACKUP_ENCRYPTION_KEY` down
somewhere **off this server** — without it no backup can be restored.

```bash
sudo docker compose --profile tools build      # app + tools images, built on the server (a few minutes)
sudo docker compose up -d                      # tailscale + db + app
sudo docker compose ps                         # all "running"; db and app "healthy"
sudo docker compose logs -f tailscale          # the device "suwa" appears in the Tailscale console
```

## 4. Database schema and the clinic

```bash
cd /opt/suwa/deploy/oracle
sudo docker compose --profile tools run --rm tools npm run db:deploy
sudo docker compose --profile tools run --rm tools npm run clinic:create -- \
  --clinic "Unawatuna Medical Centre" --name "Owner Name" --email owner@clinic.lk --password "a-strong-password"
sudo docker compose --profile tools run --rm tools npm run seed:templates -- --clinic "Unawatuna Medical Centre"
```

Moving the pilot's existing data instead of starting fresh: restore its last dump (§5, "Restore")
with the pilot PC's `BACKUP_ENCRYPTION_KEY`, then run `db:deploy` and `seed:templates`.

Check it: from a device on the tailnet open `https://suwa.<tailnet>.ts.net` → sign-in page, and
`https://suwa.<tailnet>.ts.net/api/health` → `{"status":"ok"}`.

## 5. Backups (do this before any real data goes in)

Fill in the backup remote in `.env` (Oracle Object Storage or Cloudflare R2 — see `.env.example`),
then:

```bash
sudo cp /opt/suwa/deploy/oracle/systemd/suwa-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now suwa-backup.timer
sudo systemctl start suwa-backup.service      # run once now
journalctl -u suwa-backup.service -n 50       # a .dump.enc must appear in the bucket
```

**Restore drill (before go-live, then every few months)** — into a throwaway database:

```bash
sudo docker compose exec db createdb -h 127.0.0.1 -U suwa suwa_restore_test
sudo docker compose --profile tools run --rm tools npm run restore -- \
  --from-remote <file>.dump.enc \
  --database-url "postgresql://suwa:<POSTGRES_PASSWORD>@127.0.0.1:5432/suwa_restore_test" --yes
# compare row counts with the live database, then:
sudo docker compose exec db dropdb -h 127.0.0.1 -U suwa suwa_restore_test
```

**Server lost:** create a new server (§2–3), start the stack, restore the newest dump into the
empty `suwa` database (`npm run restore -- --from-remote <file>.dump.enc --yes`), run `db:deploy`.
The Tailscale name stays the same if you remove the old device from the console first.

## 6. The clinic's PCs

1. On each front-desk PC (Windows): install Tailscale, then in an admin PowerShell
   `tailscale up --authkey <clinic key> --unattended` (stays connected when nobody is signed in).
2. Bookmark `https://suwa.<tailnet>.ts.net`; set up the A4 and 80 mm printers (print at 100%).
3. The owner signs in, fills in **Settings** (address, phone, footer text), invites staff from **Team**.

## 7. Updating

```bash
cd /opt/suwa && sudo git pull
cd deploy/oracle
sudo systemctl start suwa-backup.service                          # back up first
sudo docker compose --profile tools build
sudo docker compose --profile tools run --rm tools npm run db:deploy
sudo docker compose up -d                                          # restarts the app on the new image
sudo docker compose --profile tools run --rm tools npm run seed:templates -- --all-clinics
```

## Operations notes

- **No inbound ports** except SSH from your own IP. The database listens on 127.0.0.1 inside the
  shared container network and is not reachable from the tailnet or the internet.
- **Times:** `APP_TIMEZONE=Asia/Colombo` drives every date in the app; the server clock stays UTC.
- **Health:** `/api/health` (200 = app + database OK); `sudo docker compose ps` on the server.
- **Logs:** `sudo docker compose logs app` (rotated: 3 × 10 MB per container).
- **Disk:** `df -h /` now and then; local dumps are pruned to `BACKUP_KEEP`.
- **Never** run `docker compose down -v` — `-v` deletes the database volume.
