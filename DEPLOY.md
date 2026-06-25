# Panduan Deploy — Portal Layanan Dapodik (Ubuntu Server)

Target: **Ubuntu 22.04 LTS** atau lebih baru, dengan akses sudo.
Stack: FastAPI (Python 3.11) + React 19 + MongoDB 7 + Nginx (reverse proxy + SSL).

---

## 0. Asumsi & Persiapan

- Domain sudah pointing ke IP server (cth. `dapodik.sekolah.id` → A record ke IP server).
- User non-root dengan sudo (`useradd -m -s /bin/bash dapodik && usermod -aG sudo dapodik`).
- Akses SSH ke server.
- Code aplikasi sudah ada di GitHub atau bisa di-`scp` ke server.

```bash
# Login dan update sistem
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential ufw
```

---

## 1. Setup Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # 80 + 443
sudo ufw enable
sudo ufw status
```

> Jangan buka port 8001 (backend) atau 27017 (Mongo) ke publik — semua via Nginx.

---

## 2. Install MongoDB 7

```bash
# Import GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Tambahkan repo (Ubuntu 22.04 jammy)
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
sudo systemctl status mongod   # pastikan active (running)
```

### Aktifkan autentikasi MongoDB (recommended)

```bash
# Buat admin user
mongosh <<EOF
use admin
db.createUser({
  user: "dapodik_admin",
  pwd: "GANTI_PASSWORD_KUAT_DISINI",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" }, "readWriteAnyDatabase" ]
})
EOF

# Edit config Mongo, aktifkan auth
sudo sed -i 's/#security:/security:\n  authorization: enabled/' /etc/mongod.conf
sudo systemctl restart mongod
```

---

## 3. Install Python 3.11 & Node.js 20

```bash
# Python 3.11
sudo apt install -y python3.11 python3.11-venv python3-pip

# Node.js 20 + Yarn
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g yarn
```

Cek versi:
```bash
python3.11 --version    # Python 3.11.x
node --version          # v20.x
yarn --version          # 1.22.x
```

---

## 4. Clone / Upload Code Aplikasi

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www

# Opsi A: dari GitHub
git clone https://github.com/USERNAME/portal-layanan-dapodik.git portal-dapodik

# Opsi B: dari lokal (jalankan di mesin lokal)
# scp -r /app/* user@server:/var/www/portal-dapodik/

cd portal-dapodik
```

Struktur yang diharapkan:
```
/var/www/portal-dapodik/
├── backend/
├── frontend/
└── DEPLOY.md
```

---

## 5. Backend (FastAPI)

```bash
cd /var/www/portal-dapodik/backend

# Virtualenv
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Konfigurasi `.env`

```bash
nano /var/www/portal-dapodik/backend/.env
```

Isi:
```env
MONGO_URL="mongodb://dapodik_admin:GANTI_PASSWORD_KUAT_DISINI@localhost:27017/?authSource=admin"
DB_NAME="dapodik_ticketing"
CORS_ORIGINS="https://dapodik.sekolah.id"
JWT_SECRET="GENERATE_RANDOM_64_HEX_STRING_DISINI"
ADMIN_EMAIL="admin@dapodik.id"
ADMIN_PASSWORD="admin123"
OPERATOR_DEFAULT_PASSWORD="123456"
FONNTE_API_TOKEN="ISI_JIKA_PAKAI_WHATSAPP"
FONNTE_COUNTRY_CODE="62"
FONNTE_ENABLED="true"
```

> Generate JWT_SECRET: `python3 -c "import secrets; print(secrets.token_hex(32))"`

### Test backend manual

```bash
cd /var/www/portal-dapodik/backend
source venv/bin/activate
uvicorn server:app --host 127.0.0.1 --port 8001
# Ctrl+C untuk berhenti setelah lihat "Seed complete" di log
```

### Buat systemd service untuk backend

```bash
sudo nano /etc/systemd/system/dapodik-backend.service
```

Isi:
```ini
[Unit]
Description=Portal Layanan Dapodik - Backend (FastAPI)
After=network.target mongod.service
Requires=mongod.service

[Service]
Type=simple
User=dapodik
Group=dapodik
WorkingDirectory=/var/www/portal-dapodik/backend
Environment="PATH=/var/www/portal-dapodik/backend/venv/bin"
ExecStart=/var/www/portal-dapodik/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Aktifkan:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dapodik-backend
sudo systemctl status dapodik-backend
# cek log: sudo journalctl -u dapodik-backend -f
```

---

## 6. Frontend (React Build)

```bash
cd /var/www/portal-dapodik/frontend

# Set backend URL untuk build production
echo 'REACT_APP_BACKEND_URL=https://dapodik.sekolah.id' > .env

# Install deps & build
yarn install --frozen-lockfile
yarn build
# Output: /var/www/portal-dapodik/frontend/build/
```

> Frontend di-serve sebagai **static files** oleh Nginx. Tidak perlu Node.js runtime di production.

---

## 7. Nginx (Reverse Proxy + Static + SSL)

```bash
sudo apt install -y nginx
sudo rm /etc/nginx/sites-enabled/default

sudo nano /etc/nginx/sites-available/dapodik
```

Isi:
```nginx
server {
    listen 80;
    server_name dapodik.sekolah.id;

    # Static frontend
    root /var/www/portal-dapodik/frontend/build;
    index index.html;

    # Max upload size (lampiran 5MB × 10 file + overhead)
    client_max_body_size 60M;

    # Frontend SPA — fallback ke index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API — proxy ke FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;
}
```

Aktifkan + test:
```bash
sudo ln -s /etc/nginx/sites-available/dapodik /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Test akses HTTP: `http://dapodik.sekolah.id`

---

## 8. SSL via Let's Encrypt (Certbot)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d dapodik.sekolah.id
# Ikuti prompt: email, agree TOS, redirect HTTP→HTTPS = Yes
```

Certbot otomatis update Nginx config + setup auto-renewal (cron). Test renewal:
```bash
sudo certbot renew --dry-run
```

---

## 9. Verifikasi Akhir

1. Buka `https://dapodik.sekolah.id` di browser → halaman login muncul.
2. Login koordinator: `admin@dapodik.id` / `admin123` → masuk dashboard pimpinan.
3. Login operator: NPSN `20220001` / `123456` → masuk dashboard operator.
4. Test buat tiket dengan attachment.

Cek log jika ada masalah:
```bash
sudo journalctl -u dapodik-backend -f       # backend
sudo tail -f /var/log/nginx/error.log       # nginx
sudo tail -f /var/log/mongodb/mongod.log    # mongo
```

---

## 10. Maintenance & Update

### Update kode (deploy versi baru):
```bash
cd /var/www/portal-dapodik
git pull   # atau scp file baru

# Backend
cd backend && source venv/bin/activate
pip install -r requirements.txt --upgrade
sudo systemctl restart dapodik-backend

# Frontend
cd ../frontend
yarn install --frozen-lockfile
yarn build
# Nginx serve langsung dari folder build/, tidak perlu restart
```

### Backup MongoDB (jadwalkan harian via cron):
```bash
# Edit crontab
sudo crontab -e

# Tambahkan: backup tiap hari jam 2 pagi
0 2 * * * mongodump --uri="mongodb://dapodik_admin:PASS@localhost:27017/dapodik_ticketing?authSource=admin" --out=/var/backups/mongo/$(date +\%Y\%m\%d) && find /var/backups/mongo -mtime +30 -type d -exec rm -rf {} \;
```

### Monitoring resource (opsional):
```bash
sudo apt install -y htop
htop   # cek CPU, RAM
df -h  # cek disk
```

---

## 11. Troubleshooting Cepat

| Gejala | Cek |
|---|---|
| Halaman blank / 502 Bad Gateway | `sudo systemctl status dapodik-backend` + `journalctl -u dapodik-backend -n 50` |
| Login 401 padahal kredensial benar | Pastikan `JWT_SECRET` di .env stabil, dan `mongod` aktif |
| CORS error di browser | Set `CORS_ORIGINS="https://dapodik.sekolah.id"` di .env, restart backend |
| Frontend tidak update setelah deploy | `yarn build` ulang + hard refresh browser (Ctrl+Shift+R) |
| Upload file gagal | `client_max_body_size` di nginx + cek disk space |
| Backend tidak konek Mongo | Test: `mongosh "mongodb://dapodik_admin:PASS@localhost:27017/?authSource=admin"` |

---

## 12. Hardening (Production-Grade)

1. **Ganti semua default password** sebelum go-live (admin123 dan 123456).
2. **JWT_SECRET unik per environment** — JANGAN copy dari dev.
3. **Disable login MongoDB tanpa auth** (sudah di Section 2).
4. **Fail2ban** untuk lindungi SSH:
   ```bash
   sudo apt install -y fail2ban
   sudo systemctl enable --now fail2ban
   ```
5. **Auto security updates**:
   ```bash
   sudo apt install -y unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```
6. **HTTPS strict header** — tambahkan di nginx server block:
   ```nginx
   add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
   add_header X-Frame-Options "SAMEORIGIN" always;
   add_header X-Content-Type-Options "nosniff" always;
   ```

---

## Spesifikasi Server Minimum

| Komponen | Minimum | Direkomendasikan |
|---|---|---|
| RAM | 2 GB | 4 GB |
| CPU | 2 vCPU | 4 vCPU |
| Disk | 20 GB SSD | 40 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 / 24.04 LTS |
| Bandwidth | 1 TB/bulan | unmetered |

---

Setelah semua langkah selesai dan aplikasi running, dokumentasikan kredensial admin (password kuat baru) di password manager tim. Selamat deploy! 🚀
