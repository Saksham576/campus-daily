#!/usr/bin/env bash
# Campus Daily WhatsApp bridge — one-command setup for a fresh Ubuntu server.
#   curl -fsSL https://raw.githubusercontent.com/Saksham576/campus-daily/main/whatsapp-bridge/setup-server.sh | bash
set -euo pipefail

echo "== Campus Daily bridge setup =="

# 1 GB servers need swap for the browser WhatsApp Web runs in.
if ! swapon --show | grep -q .; then
  echo "Adding 2 GB swap…"
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

if ! command -v docker >/dev/null; then
  echo "Installing Docker…"
  curl -fsSL https://get.docker.com | sudo sh >/dev/null
fi
sudo apt-get install -y git >/dev/null 2>&1 || true

DIR="$HOME/campus-daily"
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull -q; else git clone -q --depth 1 https://github.com/Saksham576/campus-daily.git "$DIR"; fi
cd "$DIR/whatsapp-bridge"

if [ ! -f .env ]; then
  echo
  echo "Paste the INGEST_SECRET_KEY value (from whatsapp-bridge\.env on your PC) and press Enter."
  echo "(Nothing shows while you paste — that's normal.)"
  read -rs SECRET </dev/tty
  echo
  [ -n "$SECRET" ] || { echo "No key entered — run this again."; exit 1; }
  printf 'INGEST_SECRET_KEY=%s\n' "$SECRET" > .env
  chmod 600 .env
fi
mkdir -p data

echo "Building and starting the bridge (takes 3–6 minutes the first time)…"
sudo docker compose up -d --build

echo
echo "✓ Bridge is running."
echo "  Now open https://campusdaily.nexuspulsetech.com/admin and scan the QR code"
echo "  (WhatsApp → Settings → Linked devices → Link a device). Reload the page if the code expires."
echo "  Logs: cd ~/campus-daily/whatsapp-bridge && sudo docker compose logs -f"
