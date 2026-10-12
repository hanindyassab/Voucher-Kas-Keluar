# Voucher Kas Keluar

Struktur proyek:

- `Frontend/`: halaman, tampilan, dan JavaScript aplikasi.
- `Backend/`: server Node.js, endpoint API, SQL untuk Supabase, dan `start.bat`.

## Hubungkan ke Supabase

1. Buka Supabase Dashboard > SQL Editor, lalu jalankan seluruh isi `Backend/schema.sql`.
2. Di PowerShell, isi URL proyek dan **service role key** sebagai variabel untuk sesi terminal ini. Gunakan key dari Supabase Dashboard > Project Settings > API.

```powershell
$env:SUPABASE_URL = "https://project-ref.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "service-role-key"
```

Jangan taruh service role key di kode frontend atau bagikan ke orang lain. Backend memakai Node.js 18 atau lebih baru dan tidak membutuhkan `package.json` atau library tambahan.

## Jalankan

Dari folder utama proyek, jalankan:

```powershell
Set-Location Backend
.\start.bat
```

Kemudian buka `http://localhost:3000`. Isi nama penanggung jawab dan penerima pembayaran sebelum mengirim voucher. Backend menyimpan voucher beserta baris jurnal lewat satu transaksi PostgreSQL.
