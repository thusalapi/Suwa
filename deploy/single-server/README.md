# Deploying the Suwa pilot on one free server with Tailscale

A zero-cost setup for the **pilot clinic**: one small Linux server runs everything — Tailscale, the
app and PostgreSQL — with nightly encrypted backups copied off the server. There is **no public
endpoint**; the clinic reaches the app only over Tailscale at `https://suwa.<your-tailnet>.ts.net`.

Two free hosts are covered: **Google Cloud** (§2A, the current choice) and **Oracle Cloud** (§2B).
Everything else is the same. For several clinics, or when a day of data loss is not acceptable,
move to the managed-database setup in [deploy/aws](../aws/README.md).

| File | What it is |
|------|------------|
| `docker-compose.yml` | `tailscale` (HTTPS front door) + `app` + `db` (PostgreSQL 17) + on-demand `tools` |
| `.env.example` | Environment (copy to `.env` on the server) |
| `systemd/suwa-backup.{service,timer}` | Nightly backup at 01:30 Sri Lanka time |
| `../../.github/workflows/ci.yml` | Builds the images and pushes them to GitHub Container Registry |
| `../aws/tailscale/serve.json` | Tailscale serve: HTTPS on 443 → app on 127.0.0.1:3000, Funnel off (shared) |
| `../aws/tailscale-policy.hujson` | Access rules: clinic PCs → app:443 only; admins → everything (shared) |

## What "free" costs you

- **One server, one disk.** If it is lost, you restore last night's backup: up to a day of entries
  can be lost. The off-site backup (§5) and a tested restore are not optional.
- **Google Cloud:** the free server is tiny (1 GB memory) and exists only in three US regions, so
  every click from Sri Lanka travels to the US and back — expect pages to feel slower than a
  nearby server. Only about 1 GB of outbound traffic a month is free; beyond that it is billed by
  the GB (cents for one clinic, but not zero). Set a **budget alert**.
- **Oracle Cloud:** a far bigger server near Sri Lanka, but free ARM capacity is often
  unavailable and Oracle can reclaim idle free servers or close free accounts.
- Free-tier terms change. Check the provider's current page before relying on any number here.

---

## 1. Tailscale (once)

1. Create the tailnet (or use yours). Enable **MagicDNS** and **HTTPS certificates** (DNS settings).
2. Paste `../aws/tailscale-policy.hujson` into **Access controls**; set `group:admins` to your login(s).
3. **Settings → Device management:** turn on **device approval**.
4. Create an **auth key** for the server: tagged `tag:suwa-app`, pre-approved, not reusable.
5. Create a **reusable, tagged** key for the clinic (`tag:clinic-unawatuna`, pre-approved) for its
   front-desk PCs (§6). Never enable **Funnel**.

## 2A. The server — Google Cloud (free e2-micro)

The free allowance is **one `e2-micro` VM** in `us-west1`, `us-central1` or `us-east1`, with a
**30 GB standard persistent disk**. Anything else (another region, a bigger machine, a "balanced"
or SSD disk) is billed.

1. Create a Google Cloud project with billing enabled (a card is required). In **Billing →
   Budgets & alerts** create a budget of a few dollars with email alerts.
2. **Compute Engine → VM instances → Create instance**
   - Region: **us-west1** (Oregon). Machine: **E2 → e2-micro**.
   - Boot disk: **Ubuntu 24.04 LTS (x86/64)**, **Standard persistent disk**, **30 GB**.
   - Firewall: leave **Allow HTTP/HTTPS traffic unticked**.
   - Observability: untick **Install Ops Agent** (it uses memory this server does not have).
3. **Lock down SSH.** In **VPC network → Firewall**, edit `default-allow-ssh`: change the source
   from `0.0.0.0/0` to `35.235.240.0/20` (Google's IAP range). From then on use the **SSH** button
   in the console (or `gcloud compute ssh --tunnel-through-iap`). Delete `default-allow-rdp`.
   The app needs no ingress rule at all.
4. SSH in, add swap (essential with 1 GB of memory) and install Docker:

   ```bash
   sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
   sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 git
   sudo systemctl enable --now docker
   ```

5. **Images are built by GitHub, not on this server** (it cannot run the build). Every push to
   `master` runs `.github/workflows/ci.yml`, which publishes `ghcr.io/<owner>/suwa-app` and
   `suwa-tools`. Let the server pull them: on GitHub create a **personal access token (classic)**
   with only the `read:packages` scope, then on the server:

   ```bash
   sudo docker login ghcr.io -u <your-github-username>     # paste the token as the password
   ```

   In `.env` (§3) uncomment the "Small servers" block: `PG_SHARED_BUFFERS`, `NODE_OPTIONS`,
   `SUWA_APP_IMAGE`, `SUWA_TOOLS_IMAGE` (with your GitHub owner name, lowercase).

   **Without GitHub Actions** (e.g. while it is unavailable): build on your own PC and copy the
   images across. On the PC, in the repository root, with Docker running:

   ```bash
   docker build --target app -t suwa-app:latest .
   docker build --target tools -t suwa-tools:latest .
   docker save suwa-app:latest suwa-tools:latest | gzip > suwa-images.tar.gz     # several hundred MB
   gcloud compute scp suwa-images.tar.gz <instance>:~ --tunnel-through-iap
   ```

   On the server: `gunzip -c ~/suwa-images.tar.gz | sudo docker load && rm ~/suwa-images.tar.gz`.
   Then in `.env` uncomment only `PG_SHARED_BUFFERS` and `NODE_OPTIONS` (leave the two image
   lines commented) and skip the `pull` step in §3.

## 2B. The server — Oracle Cloud (Always Free ARM)

1. Sign up at oracle.com/cloud/free. Choose a **home region** near Sri Lanka (Mumbai, Hyderabad or
   Singapore) — it cannot be changed later, and Always Free resources exist only there.
2. **Compute → Instances → Create instance:** Ubuntu 24.04 (aarch64), shape
   **VM.Standard.A1.Flex** with **2 OCPU / 12 GB**, default VCN with a public IPv4 address, your
   SSH public key, 50 GB boot volume.
3. In the subnet's **security list**, change the SSH rule (TCP 22) from `0.0.0.0/0` to **your own
   IP address only**. Add no other ingress rules.
4. SSH in (`ssh ubuntu@<public-ip>`) and install Docker:

   ```bash
   sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 git
   sudo systemctl enable --now docker
   ```

5. This server is big enough to **build the images itself** (the GitHub-built ones are x86 only):
   leave the "Small servers" block in `.env` commented and, in §3, run
   `sudo docker compose --profile tools build` instead of `pull`.

## 3. Code, configuration, first start

```bash
sudo git clone https://github.com/<you>/Suwa.git /opt/suwa     # private repo: use a deploy key or token
cd /opt/suwa/deploy/single-server
sudo cp .env.example .env && sudo chmod 600 .env
sudo nano .env      # POSTGRES_PASSWORD, SESSION_SECRET, TS_AUTHKEY, BACKUP_ENCRYPTION_KEY, backup remote
```

Generate secrets on the server: `openssl rand -hex 24` (database password) and
`openssl rand -base64 48` (session secret, backup key). Write `BACKUP_ENCRYPTION_KEY` down
somewhere **off this server** — without it no backup can be restored.

```bash
sudo docker compose --profile tools pull       # Google Cloud: fetch the GitHub-built images
# sudo docker compose --profile tools build    # Oracle: build on the server instead
sudo docker compose up -d                      # tailscale + db + app
sudo docker compose ps                         # all "running"; db and app "healthy"
sudo docker compose logs -f tailscale          # the device "suwa" appears in the Tailscale console
```

## 4. Database schema and the clinic

```bash
cd /opt/suwa/deploy/single-server
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

Fill in the backup remote in `.env` — **Cloudflare R2** on Google Cloud (a different provider
from the server), or Oracle Object Storage on Oracle; see `.env.example` — then:

```bash
sudo cp /opt/suwa/deploy/single-server/systemd/suwa-backup.* /etc/systemd/system/
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

Push to `master` and wait for the **CI** workflow to finish (it publishes the new images), then:

```bash
cd /opt/suwa && sudo git pull
cd deploy/single-server
sudo systemctl start suwa-backup.service                          # back up first
sudo docker compose --profile tools pull                           # Oracle: build instead
sudo docker compose --profile tools run --rm tools npm run db:deploy
sudo docker compose up -d                                          # restarts the app on the new image
sudo docker compose --profile tools run --rm tools npm run seed:templates -- --all-clinics
sudo docker image prune -f                                         # the disk is small
```

## Operations notes

- **No inbound ports** except SSH (through IAP on Google Cloud, from your own IP on Oracle). The
  database listens on 127.0.0.1 inside the shared container network and is not reachable from the
  tailnet or the internet.
- **Times:** `APP_TIMEZONE=Asia/Colombo` drives every date in the app; the server clock stays UTC.
- **Health:** `/api/health` (200 = app + database OK); `sudo docker compose ps` on the server.
- **Memory (1 GB server):** `free -m`; if the app is killed under load (`dmesg | grep -i oom`),
  the server is too small — move to a 2 GB one.
- **Logs:** `sudo docker compose logs app` (rotated: 3 × 10 MB per container).
- **Disk:** `df -h /` now and then; local dumps are pruned to `BACKUP_KEEP`.
- **Never** run `docker compose down -v` — `-v` deletes the database volume.
