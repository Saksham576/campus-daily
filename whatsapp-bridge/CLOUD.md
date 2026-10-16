# Run the WhatsApp bridge on a server (always on)

Any small Linux server works (1 GB RAM is enough): Oracle Cloud "Always Free", or a ₹300–500/month VPS.

1. On the server: install Docker (`curl -fsSL https://get.docker.com | sh`).
2. Copy this `whatsapp-bridge` folder to the server (without `node_modules`).
3. Create `whatsapp-bridge/.env` with the same `INGEST_SECRET_KEY` as the PC.
4. `docker compose up -d --build`
5. Open https://campusdaily.nexuspulsetech.com/admin — a QR code appears under **WhatsApp bridge**.
   Scan it with the spare phone (WhatsApp → Settings → Linked devices → Link a device).
6. Stop the PC version: `Unregister-ScheduledTask CampusDailyWhatsAppBridge` (PowerShell), so only one runs.

Logs: `docker compose logs -f`. Update: copy new files, then `docker compose up -d --build`.

## More groups
The bridge reads every group the spare number is in with 50+ members (admins' posts only).
To cover more of campus, ask class reps / hostel / club admins to add the spare number to their groups —
nothing else to install for them.
