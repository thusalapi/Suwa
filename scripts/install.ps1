<#
.SYNOPSIS
  One-shot install of Suwa on a single clinic PC (Windows).

.DESCRIPTION
  Installs Node + PostgreSQL, creates the database and role, generates real secrets, applies
  the schema, seeds the owner account, builds the app, and registers two scheduled tasks
  (app on startup, backup nightly).

  Safe to re-run: it never overwrites an existing .env, never drops the database, and skips
  anything already in place.

  Run from the repo root in an ELEVATED PowerShell:
      .\scripts\install.ps1 -ClinicName "Name" -OwnerName "Owner" -OwnerEmail owner@clinic.lk

.NOTES
  Single-PC deployment: the app binds to localhost only. Serving other machines on the
  clinic network is out of scope here and would need TLS, a firewall rule and a real DB
  password policy.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ClinicName,
  [Parameter(Mandatory = $true)][string]$OwnerName,
  [Parameter(Mandatory = $true)][string]$OwnerEmail,
  [int]$Port = 3000,
  [switch]$SkipPrereqs
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $repo

function Say($m) { Write-Host "  $m" }
function Step($m) { Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Fail($m) { Write-Host "ERROR: $m" -ForegroundColor Red; exit 1 }

# Installers update the machine PATH, but this process inherited the old one; re-read it so
# node/npm/psql resolve without a reboot. (Without this, every step below fails.)
function Sync-Path {
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
              [System.Environment]::GetEnvironmentVariable('Path', 'User')
}

function Have($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

function Random-Secret([int]$bytes = 32) {
  $b = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return -join ($b | ForEach-Object { $_.ToString('x2') })
}

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Fail "Run this in an elevated PowerShell (needed for installs and scheduled tasks)."
}

# ---------------------------------------------------------------- prerequisites
Step "Prerequisites"
Sync-Path
if (-not $SkipPrereqs) {
  if (-not (Have winget)) { Fail "winget not found. Install 'App Installer' from the Microsoft Store, then re-run." }

  if (Have node) { Say "Node already installed ($(node --version))" }
  else {
    Say "Installing Node.js LTS..."
    winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements | Out-Null
    Sync-Path
  }

  if (Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue) { Say "PostgreSQL service already present" }
  else {
    $pgPass = Random-Secret 12
    Say "Installing PostgreSQL 17..."
    winget install --id PostgreSQL.PostgreSQL.17 -e --source winget --accept-package-agreements --accept-source-agreements `
      --override "--mode unattended --unattendedmodeui minimal --superpassword $pgPass --servicename postgresql-x64-17 --servicepassword $pgPass" | Out-Null
    Say "PostgreSQL superuser password: $pgPass"
    Say "  ^ write this down now; it is not stored anywhere."
    Sync-Path
  }
}
Sync-Path
if (-not (Have node)) { Fail "node is still not on PATH. Open a new elevated PowerShell and re-run with -SkipPrereqs." }

# psql/pg_dump live in the Postgres bin dir, which the unattended installer does NOT add to PATH.
# The nightly backup shells out to a bare `pg_dump`, so this must be on the MACHINE path or
# backups fail silently at 01:30.
$pgBin = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
         Sort-Object FullName -Descending | Select-Object -First 1
if (-not $pgBin) { Fail "Could not find psql.exe under C:\Program Files\PostgreSQL. Is PostgreSQL installed?" }
$pgBinDir = Split-Path $pgBin.FullName
$machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
if ($machinePath -notlike "*$pgBinDir*") {
  Say "Adding $pgBinDir to the machine PATH (needed by the nightly backup)"
  [System.Environment]::SetEnvironmentVariable('Path', "$machinePath;$pgBinDir", 'Machine')
  Sync-Path
}
Say "Node $(node --version) | psql $(& $pgBin.FullName --version)"

# ---------------------------------------------------------------- database
Step "Database"
$envPath = Join-Path $repo '.env'
if (Test-Path $envPath) {
  Say ".env already exists - keeping it (no secrets regenerated, no DB role changes)."
  $dbUrl = (Select-String -Path $envPath -Pattern '^DATABASE_URL=(.+)$').Matches.Groups[1].Value
} else {
  $dbPass = Random-Secret 16
  $superPass = Read-Host "PostgreSQL 'postgres' superuser password" -AsSecureString
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($superPass))

  Say "Creating role and database 'suwa'..."
  $roleExists = & $pgBin.FullName -U postgres -h localhost -At -c "select 1 from pg_roles where rolname='suwa'"
  if ($roleExists -ne '1') {
    & $pgBin.FullName -U postgres -h localhost -c "CREATE ROLE suwa LOGIN PASSWORD '$dbPass';" | Out-Null
  } else {
    & $pgBin.FullName -U postgres -h localhost -c "ALTER ROLE suwa PASSWORD '$dbPass';" | Out-Null
    Say "Role existed; password reset to the newly generated one."
  }
  $dbExists = & $pgBin.FullName -U postgres -h localhost -At -c "select 1 from pg_database where datname='suwa'"
  if ($dbExists -ne '1') { & $pgBin.FullName -U postgres -h localhost -c "CREATE DATABASE suwa OWNER suwa;" | Out-Null }
  $env:PGPASSWORD = $null

  $dbUrl = "postgresql://suwa:$dbPass@localhost:5432/suwa"
  Say "Writing .env with freshly generated secrets..."
  @(
    "# Generated by scripts/install.ps1 on $(Get-Date -Format 'yyyy-MM-dd HH:mm'). Never commit.",
    "DATABASE_URL=$dbUrl",
    "SESSION_SECRET=$(Random-Secret 32)",
    "DEFAULT_LOCALE=en",
    "BACKUP_ENCRYPTION_KEY=$(Random-Secret 32)"
  ) | Set-Content -Path $envPath -Encoding utf8
  Say "BACKUP_ENCRYPTION_KEY was generated - copy .env somewhere OFF this PC."
  Say "  Without that key the encrypted backups cannot be restored. Ever."
}

# ---------------------------------------------------------------- app
Step "Application"
Say "Installing dependencies..."
npm ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Fail "npm ci failed." }

Say "Applying database schema..."
npm run db:deploy
if ($LASTEXITCODE -ne 0) { Fail "Migration failed." }

$ownerCount = & $pgBin.FullName $dbUrl -At -c "select count(*) from users where role='owner'" 2>$null
if ($ownerCount -eq '0' -or [string]::IsNullOrWhiteSpace($ownerCount)) {
  $pw = Read-Host "Password for the owner account ($OwnerEmail)" -AsSecureString
  $pwPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw))
  npm run seed:owner -- --clinic "$ClinicName" --name "$OwnerName" --email "$OwnerEmail" --password "$pwPlain"
  $pwPlain = $null
} else {
  Say "An owner account already exists - skipping seed."
}

Say "Building..."
npm run build
if ($LASTEXITCODE -ne 0) { Fail "Build failed." }

# ---------------------------------------------------------------- scheduled tasks
Step "Scheduled tasks"
$npmCmd = (Get-Command npm.cmd).Source
New-Item -ItemType Directory -Force -Path (Join-Path $repo 'logs') | Out-Null

# Start on boot. ONSTART runs as SYSTEM, which is why Postgres bin had to go on the MACHINE path.
schtasks /Create /F /TN "Suwa App" /SC ONSTART /RU SYSTEM /RL HIGHEST `
  /TR "cmd /c cd /d `"$repo`" && set PORT=$Port && `"$npmCmd`" run start >> logs\app.log 2>&1" | Out-Null
Say "Registered 'Suwa App' (starts on boot, port $Port)"

schtasks /Create /F /TN "Suwa Nightly Backup" /SC DAILY /ST 01:30 /RU SYSTEM /RL HIGHEST `
  /TR "cmd /c cd /d `"$repo`" && `"$npmCmd`" run backup >> logs\backup.log 2>&1" | Out-Null
Say "Registered 'Suwa Nightly Backup' (01:30 daily)"

schtasks /Run /TN "Suwa App" | Out-Null

Step "Done"
Say "App:    http://localhost:$Port"
Say "Sign in as $OwnerEmail"
Write-Host ""
Say "Still to do by hand:"
Say "  1. Copy .env off this PC (the backup key lives there)."
Say "  2. Turn on BitLocker - this laptop holds patient records."
Say "  3. Run a restore drill before real data goes in (docs/backups.md)."
