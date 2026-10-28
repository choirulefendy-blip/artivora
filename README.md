# Artivora Creative — website

<img src="assets/img/logo.webp" alt="Artivora" width="140">

Website company profile Artivora Creative di **https://artivora.my.id**, di-hosting gratis di GitHub Pages, lengkap dengan halaman admin di **/admin** untuk mengubah isinya tanpa coding.

## Cara kerjanya

- Semua isi website (teks, harga, layanan, studi kasus, kontak) disimpan di `content.json`.
- Halaman admin membaca `content.json` dari repo ini lewat GitHub API. Saat kamu klik **Publikasikan**, admin menyimpan `content.json`, membuat ulang `index.html` dan `sitemap.xml`, mengunggah gambar baru ke `assets/uploads/`, lalu semuanya masuk ke GitHub dalam **satu commit**.
- GitHub Pages otomatis memperbarui website sekitar 1 menit setelah commit.
- Tidak ada database atau server terpisah. Riwayat setiap perubahan tersimpan di tab *Commits*, jadi versi lama selalu bisa dikembalikan.

## Setup pertama (sekali saja)

### 1. Aktifkan GitHub Pages

1. Buka repo ini → **Settings** → **Pages**.
2. **Source**: *Deploy from a branch*. **Branch**: `main`, folder `/ (root)`. Klik **Save**.
3. **Custom domain** akan terisi `artivora.my.id` otomatis dari file `CNAME`. Kalau kosong, ketik `artivora.my.id` lalu **Save**.

### 2. Atur DNS di indo.domains

Masuk ke panel indo.domains → domain **artivora.my.id** → pengaturan DNS (DNS Management / Zone Editor). Hapus record `A`/`CNAME` bawaan untuk `@` dan `www` kalau ada, lalu tambahkan:

| Type | Host / Name | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA *(opsional)* | `@` | `2606:50c0:8000::153` |
| AAAA *(opsional)* | `@` | `2606:50c0:8001::153` |
| AAAA *(opsional)* | `@` | `2606:50c0:8002::153` |
| AAAA *(opsional)* | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `choirulefendy-blip.github.io` |

Kalau panel indo.domains tidak menyediakan DNS management, pastikan nameserver domain memakai DNS bawaan indo.domains terlebih dulu.

Perubahan DNS bisa butuh beberapa menit sampai 24 jam. Setelah domain terhubung, kembali ke **Settings → Pages** dan centang **Enforce HTTPS** (opsi ini bisa baru muncul beberapa jam kemudian).

### 3. Buat token untuk admin

1. Buka https://github.com/settings/personal-access-tokens/new
2. **Token name**: `Artivora admin`. **Expiration**: sesuai kebutuhan (misalnya 1 tahun).
3. **Repository access**: *Only select repositories* → pilih `artivora`.
4. **Permissions → Repository permissions → Contents**: **Read and write**.
5. **Generate token**, salin, lalu tempel di halaman login **https://artivora.my.id/admin**.

Token hanya tersimpan di browser perangkat yang dipakai login. Jangan bagikan token. Kalau token bocor atau perangkat hilang, hapus token di halaman yang sama di GitHub, lalu buat yang baru.

## Memakai admin

- Pilih bagian di menu kiri, ubah isinya, lalu klik **Publikasikan**.
- **Pratinjau** menampilkan hasilnya sebelum dipublikasikan, dalam ukuran desktop atau HP.
- Setiap bagian punya tombol **Tampilkan di website**. Bagian yang disembunyikan tidak muncul di website, tapi isinya tetap tersimpan.
- Gambar otomatis diperkecil dan dikompres di browser sebelum diunggah.
- Perubahan yang belum dipublikasikan tersimpan sebagai draf di perangkat itu, jadi aman kalau tab tertutup.

## Struktur file

```
index.html          dibuat otomatis dari content.json (jangan diedit manual)
content.json        semua isi website
sitemap.xml         dibuat otomatis
CNAME               domain artivora.my.id untuk GitHub Pages
admin/              halaman admin
assets/js/render.js mesin yang mengubah content.json menjadi index.html
assets/css/site.css tampilan website
assets/js/site.js   menu HP dan form WhatsApp
assets/uploads/     gambar yang diunggah dari admin
assets/fonts/       Plus Jakarta Sans (lisensi SIL OFL)
assets/img/         logo, favicon, dan gambar saat link dibagikan
scripts/build.js    membuat ulang index.html dari terminal
```

## Untuk developer

Setelah mengubah `content.json` atau `assets/js/render.js` secara manual:

```bash
node scripts/build.js
```

Setelah mengubah `site.css` atau `site.js`, naikkan `ASSET_VERSION` di `assets/js/render.js` lalu jalankan perintah di atas, supaya browser pengunjung mengambil file yang baru.
