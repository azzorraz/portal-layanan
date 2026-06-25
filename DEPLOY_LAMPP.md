# Panduan Deploy — Portal Layanan Dapodik di Ubuntu Server (sudah ada LAMPP)

Skenario: Ubuntu Server **sudah terinstall LAMPP** (XAMPP for Linux) menjalankan aplikasi PHP/MySQL eksisting. Kita akan deploy Portal Layanan Dapodik berdampingan dengan LAMPP, **tanpa mengganggu** aplikasi lama Anda.

**Strategi co-existence:**

| Port | Servis | Untuk |
|---|---|---|
| **80 / 443** | Nginx | Portal Layanan Dapodik (domain baru, mis. `dapodik.sekolah.id`) |
| **8080** | Apache (LAMPP) | Aplikasi PHP lama Anda |
| **3306** | MySQL (LAMPP) | Database PHP lama Anda — TIDAK dipakai Dapodik |
| **27017** | MongoDB (baru) | Database Portal Dapodik — internal only |
| **8001** | FastAPI (uvicorn) | Backend Dapodik — internal only, di-proxy oleh Nginx |

Aplikasi PHP lama tetap bisa diakses via `http://server-ip:8080` atau via subdomain terpisah (mis. `lama.sekolah.id` → port 8080).

---

## TAHAP 1 — Pindahkan Apache LAMPP dari port 80 ke 8080

Ini agar Nginx bisa pakai port 80/443 untuk Portal Dapodik.

### 1.1 Backup config dulu

```bash
sudo cp /opt/lampp/etc/httpd.conf /opt/lampp/etc/httpd.conf.bak
sudo cp /opt/lampp/etc/extra/httpd-ssl.conf /opt/lampp/etc/extra/httpd-ssl.conf.bak
```

### 1.2 Edit httpd.conf (HTTP)

```bash
sudo nano /opt/lampp/etc/httpd.conf
```

Cari & ganti:
```apache
# DARI:
Listen 80
ServerName localhost:80

# JADI:
Listen 8080
ServerName localhost:8080
```

### 1.3 Edit httpd-ssl.conf (HTTPS — jika LAMPP pakai SSL)

```bash
sudo nano /opt/lampp/etc/extra/httpd-ssl.conf
```

Cari & ganti `443` → `8443` (di baris `Listen 443` dan `<VirtualHost _default_:443>`).

### 1.4 (Opsional) Matikan SSL LAMPP jika tidak dipakai

Jika aplikasi PHP lama tidak butuh HTTPS (karena nanti diakses internal/8080), comment out baris ini di `httpd.conf`:
```apache
# Include etc/extra/httpd-ssl.conf
```

### 1.5 Restart LAMPP

```bash
sudo /opt/lampp/lampp restart
```

Verifikasi:
```bash
curl -I http://localhost:8080      # harus 200 OK dari Apache
sudo ss -tlnp | grep -E '80|8080'  # port 80 harus KOSONG sekarang
```

---

## TAHAP 2 — Install MongoDB (tidak konflik dengan MySQL LAMPP)

MySQL LAMPP di port 3306, MongoDB di port 27017 — **tidak akan tabrakan**.

```bash
# Update sistem
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl gnupg

# Import GPG key MongoDB 7
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Tambahkan repo (Ubuntu 22.04 jammy; ganti 'jammy' → 'noble' untuk Ubuntu 24.04)
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
sudo systemctl status mongod
```

### 2.1 Aktifkan auth MongoDB

```bash
# Buat admin user
mongosh <<'EOF'
use admin
db.createUser({
  user: "dapodik_admin",
  pwd: "GANTI_PASSWORD_KUAT_DISINI",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" }, "readWriteAnyDatabase" ]
})
EOF

# Aktifkan auth di config
sudo sed -i 's/#security:/security:\n  authorization: enabled/' /etc/mongod.conf
sudo systemctl restart mongod

# Verifikasi
mongosh "mongodb://dapodik_admin:GANTI_PASSWORD_KUAT_DISINI@localhost:27017/?authSource=admin" --eval "db.runCommand({ping:1})"
```

---

## TAHAP 3 — Install Python 3.11, Node.js 20, Yarn, Nginx

```bash
sudo apt install -y python3.11 python3.11-venv python3-pip build-essential git nginx ufw

# Node.js 20 + Yarn
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g yarn
```

Verifikasi:
```bash
python3.11 --version && node --version && yarn --version && nginx -v
```

---

## TAHAP 4 — Setup Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'            # 80 + 443 untuk Portal Dapodik

# Pilih SALAH SATU untuk akses Apache LAMPP:
sudo ufw allow 8080/tcp                # OPSI 1: buka 8080 ke publik (akses langsung)
# atau biarkan tidak dibuka — akses LAMPP cuma dari localhost / VPN

sudo ufw enable
sudo ufw status
```

> **Saran**: jika aplikasi PHP lama hanya untuk admin internal, **jangan buka 8080 ke publik**. Akses via SSH tunnel atau buatkan subdomain `lama.sekolah.id` dengan SSL terpisah (lihat Tahap 9).

---

## TAHAP 5 — Deploy Kode Portal Layanan Dapodik

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www

# Opsi A: clone dari GitHub
git clone https://github.com/USERNAME/portal-layanan-dapodik.git portal-dapodik

# Opsi B: scp dari lokal Anda
# scp -r /app/* user@server-ip:/var/www/portal-dapodik/

cd portal-dapodik
```

Struktur yang diharapkan:
```
/var/www/portal-dapodik/
├── backend/      (FastAPI)
└── frontend/     (React)
```

---

## TAHAP 6 — Setup Backend (FastAPI)

```bash
cd /var/www/portal-dapodik/backend

python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
```

### 6.1 Konfigurasi `.env`

```bash
nano /var/www/portal-dapodik/backend/.env
```

```env
MONGO_URL="mongodb://dapodik_admin:GANTI_PASSWORD_KUAT_DISINI@localhost:27017/?authSource=admin"
DB_NAME="dapodik_ticketing"
CORS_ORIGINS="https://dapodik.sekolah.id"
JWT_SECRET="GENERATE_DENGAN: python3 -c 'import secrets;print(secrets.token_hex(32))'"
ADMIN_EMAIL="admin@dapodik.id"
ADMIN_PASSWORD="GANTI_PASSWORD_ADMIN_KUAT"
OPERATOR_DEFAULT_PASSWORD="123456"
FONNTE_API_TOKEN=""
FONNTE_COUNTRY_CODE="62"
FONNTE_ENABLED="false"
```

### 6.2 systemd service

```bash
sudo nano /etc/systemd/system/dapodik-backend.service
```

```ini
[Unit]
Description=Portal Layanan Dapodik - Backend (FastAPI)
After=network.target mongod.service
Requires=mongod.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/portal-dapodik/backend
Environment="PATH=/var/www/portal-dapodik/backend/venv/bin"
ExecStart=/var/www/portal-dapodik/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Fix ownership
sudo chown -R www-data:www-data /var/www/portal-dapodik

# Aktifkan service
sudo systemctl daemon-reload
sudo systemctl enable --now dapodik-backend
sudo systemctl status dapodik-backend

# Cek log seed
sudo journalctl -u dapodik-backend -n 50 --no-pager
```

Pastikan muncul `INFO - Seed complete` dan `Application startup complete`.

---

## TAHAP 7 — Build Frontend (React)

```bash
cd /var/www/portal-dapodik/frontend

echo 'REACT_APP_BACKEND_URL=https://dapodik.sekolah.id' > .env

yarn install --frozen-lockfile
yarn build
# Output: /var/www/portal-dapodik/frontend/build/
```

Fix ownership lagi setelah build:
```bash
sudo chown -R www-data:www-data /var/www/portal-dapodik/frontend/build
```

---

## TAHAP 8 — Nginx (Reverse Proxy + Static Frontend)

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo nano /etc/nginx/sites-available/dapodik
```

```nginx
server {
    listen 80;
    server_name dapodik.sekolah.id;

    root /var/www/portal-dapodik/frontend/build;
    index index.html;

    client_max_body_size 60M;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API → FastAPI
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

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/dapodik /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Test HTTP: `http://dapodik.sekolah.id` → halaman login muncul.

---

## TAHAP 9 — SSL (Let's Encrypt / Certbot)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d dapodik.sekolah.id
# Pilih: redirect HTTP → HTTPS = Yes

# Test auto-renewal
sudo certbot renew --dry-run
```

### 9.1 (Opsional) Buatkan subdomain untuk aplikasi PHP lama dengan SSL

Jika Anda ingin akses LAMPP via `https://lama.sekolah.id` (lebih aman daripada port 8080 publik):

```bash
sudo nano /etc/nginx/sites-available/lampp
```

```nginx
server {
    listen 80;
    server_name lama.sekolah.id;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lampp /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d lama.sekolah.id
sudo ufw delete allow 8080/tcp   # tutup akses publik 8080 — sudah via Nginx
```

Sekarang aplikasi PHP Anda di-akses via `https://lama.sekolah.id` (Nginx → port 8080 → Apache LAMPP), dengan SSL gratis.

---

## TAHAP 10 — Verifikasi Akhir

1. Buka `https://dapodik.sekolah.id` → halaman login muncul, branding "Portal Layanan Dapodik" biru.
2. Login koordinator: `admin@dapodik.id` / password yang Anda set di `.env`.
3. Login operator: NPSN `20220001` / `123456`.
4. Buat tiket test dengan attachment.
5. (Jika setup subdomain LAMPP) Akses `https://lama.sekolah.id` → PHP lama jalan normal.

**Health check command:**
```bash
sudo systemctl status mongod dapodik-backend nginx
sudo /opt/lampp/lampp status
curl -I https://dapodik.sekolah.id
curl -I http://localhost:8080
```

---

## TAHAP 11 — Maintenance Routine

### Auto-start LAMPP saat boot

LAMPP tidak otomatis start. Buat systemd unit:
```bash
sudo nano /etc/systemd/system/lampp.service
```

```ini
[Unit]
Description=XAMPP/LAMPP
After=network.target

[Service]
Type=forking
ExecStart=/opt/lampp/lampp start
ExecStop=/opt/lampp/lampp stop
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable lampp
```

### Backup harian (Mongo + MySQL)

```bash
sudo crontab -e
```

```cron
# MongoDB backup tiap hari 02:00, retensi 30 hari
0 2 * * * mongodump --uri="mongodb://dapodik_admin:PASS@localhost:27017/dapodik_ticketing?authSource=admin" --out=/var/backups/mongo/$(date +\%Y\%m\%d) && find /var/backups/mongo -mtime +30 -type d -exec rm -rf {} \;

# MySQL backup tiap hari 02:30
30 2 * * * /opt/lampp/bin/mysqldump -u root -pPASS --all-databases | gzip > /var/backups/mysql/all_$(date +\%Y\%m\%d).sql.gz && find /var/backups/mysql -mtime +30 -name "*.sql.gz" -delete
```

### Update aplikasi (deploy versi baru)

```bash
cd /var/www/portal-dapodik
git pull

# Backend
cd backend && source venv/bin/activate
pip install -r requirements.txt --upgrade
sudo systemctl restart dapodik-backend

# Frontend
cd ../frontend
yarn install --frozen-lockfile
yarn build
sudo chown -R www-data:www-data build
# Nginx serve static langsung, tidak perlu restart
```

---

## TAHAP 12 — Troubleshooting Khusus LAMPP

| Gejala | Cek |
|---|---|
| Port 80 sudah dipakai saat reload Nginx | `sudo ss -tlnp \| grep :80` — pastikan LAMPP Apache benar-benar pindah ke 8080. Restart: `sudo /opt/lampp/lampp restart`. |
| LAMPP tidak mau start setelah edit httpd.conf | `sudo /opt/lampp/lampp configtest` — cari typo. Restore dari `.bak`. |
| Nginx 502 Bad Gateway ke `/api/` | `sudo systemctl status dapodik-backend` + `journalctl -u dapodik-backend -n 50` |
| MongoDB tidak nyambung | Test: `mongosh "mongodb://dapodik_admin:PASS@localhost:27017/?authSource=admin"` — cek password & `authSource=admin`. |
| MySQL LAMPP tidak nyala | `sudo /opt/lampp/lampp startmysql` — cek log di `/opt/lampp/var/mysql/*.err` |
| Conflict service apache2 default Ubuntu | `sudo systemctl disable --now apache2` — kita pakai Apache dari LAMPP, bukan default Ubuntu |
| File frontend tidak load (403 Forbidden) | `sudo chown -R www-data:www-data /var/www/portal-dapodik/frontend/build && sudo chmod -R 755 /var/www/portal-dapodik/frontend/build` |

### Cek port mapping setelah deploy

```bash
sudo ss -tlnp | grep -E ':(80|443|8001|8080|3306|27017)\s'
```

Output yang diharapkan:
```
LISTEN  127.0.0.1:8001          uvicorn      (backend Dapodik)
LISTEN  127.0.0.1:27017         mongod       (MongoDB)
LISTEN  0.0.0.0:80              nginx        (Portal Dapodik HTTP)
LISTEN  0.0.0.0:443             nginx        (Portal Dapodik HTTPS)
LISTEN  0.0.0.0:8080            httpd        (Apache LAMPP)
LISTEN  127.0.0.1:3306          mysqld       (MySQL LAMPP)
```

---

## ⚠️ Checklist Wajib Sebelum Go-Live

- [ ] **Ganti password admin MongoDB** di `/etc/mongod.conf` dan `.env` (jangan pakai `GANTI_PASSWORD_KUAT_DISINI`)
- [ ] **Generate `JWT_SECRET` baru**: `python3 -c "import secrets; print(secrets.token_hex(32))"`
- [ ] **Ganti `ADMIN_PASSWORD`** di `.env` (jangan `admin123`)
- [ ] **Operator wajib ganti password default** `123456` setelah login pertama
- [ ] **MySQL root password** LAMPP juga harus diset (default kosong di XAMPP — bahaya jika 3306 publik!)
- [ ] **Backup harian** sudah aktif di cron
- [ ] **Auto-renewal SSL** sudah ditest (`certbot renew --dry-run`)
- [ ] **Firewall UFW** aktif dan hanya buka port yang perlu

---

## Spesifikasi Server Minimum (dengan LAMPP + MongoDB)

| Komponen | Minimum | Direkomendasikan |
|---|---|---|
| RAM | 3 GB | 6 GB |
| CPU | 2 vCPU | 4 vCPU |
| Disk | 30 GB SSD | 60 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 / 24.04 LTS |

> Mongo idle ~150 MB, MySQL idle ~200 MB, Backend FastAPI ~200 MB, Apache LAMPP ~100 MB. Plus OS + Nginx + cache. 3 GB RAM cukup untuk traffic ringan-sedang.

---

Selamat deploy! Setelah live, kirim screenshot login page-nya — saya bisa bantu validasi konfigurasinya benar. 🚀
