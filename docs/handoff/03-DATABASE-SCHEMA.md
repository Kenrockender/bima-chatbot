# Database Schema — Firestore

Sera menggunakan **Cloud Firestore** (mode NoSQL, dokumen/koleksi) sebagai satu-satunya penyimpanan persisten. Tidak ada SQL/SQLite lagi di jalur produksi (SQLite sudah sepenuhnya digantikan sejak migrasi Firebase — lihat memori `firestore-auth-migration`).

**Desain kunci:** backend FastAPI (`firebase-admin`) adalah **satu-satunya klien Firestore**. Frontend Next.js hanya memakai Firebase untuk **autentikasi** (Google Sign-In) — semua baca/tulis data lewat REST API backend dengan `Authorization: Bearer <Firebase ID token>`.

---

## Diagram Relasi (logis)

```
sources (top-level collection)
  {sourceId}                        ← 1 dokumen per PDF/URL yang di-ingest

training_sessions (top-level collection)
  {sessionId}                       ← write-through cache sesi roleplay aktif (TTL 4 jam)

users (top-level collection)
  {uid}                             ← ringkasan progres FA (denormalized, untuk leaderboard & manager dashboard)
    attempts (subcollection)
      {attemptId}                   ← 1 dokumen per sesi roleplay yang SELESAI dievaluasi
```

Tidak ada foreign key formal (Firestore tidak mendukungnya) — relasi dijaga secara konvensi oleh kode aplikasi:
- `users/{uid}` di-*refresh* setiap kali `attempts` baru ditulis (`progress._update_summary`), sehingga leaderboard & manager dashboard cukup baca `users` tanpa scan seluruh `attempts` semua FA.
- `training_sessions/{id}` dihapus begitu sesi berakhir (`sessions.end()`); tidak permanen.

---

## 1. `sources` — Basis pengetahuan dokumen produk

Satu dokumen = satu sumber (PDF diunggah admin, atau `.txt` hasil seeding, atau URL).

| Field | Tipe | Deskripsi |
|---|---|---|
| `name` | string | Nama tampilan (nama file asli / judul URL) |
| `type` | `"pdf"` \| `"url"` | Jenis sumber |
| `insurer` | string | Tag penerbit — `"BCA Life"` (produk kami) atau nama kompetitor (`"Manulife"`, `"Prudential"`, `"AIA"`, `"MSIG Life"`). Menentukan pengelompokan `PENERBIT: ... (PRODUK KAMI)` vs `(KOMPETITOR)` di prompt chat. |
| `origin` | string | Path file asli / URL sumber |
| `status` | `"processing"` \| `"ready"` \| `"failed"` | Status ekstraksi teks |
| `error` | string \| null | Pesan error kalau `status = failed` |
| `page_count` | int | Jumlah halaman/chunk yang diekstrak |
| `text` | string | **Teks penuh hasil ekstraksi** — inilah yang di-*stuff* ke prompt LLM. Firestore membatasi 1 MiB/dokumen; teks brosur produk jauh di bawah itu. |
| `created_at` | string (ISO 8601 UTC) | Waktu dibuat |
| `updated_at` | string (ISO 8601 UTC) | Waktu terakhir diubah |

Doc id = `source_id` (uuid4 hex), dibuat di `backend/app/db.py::create_source`.

> Catatan: listing publik (`list_sources()`) menyembunyikan field `text` (berat) — lihat `_public()`. Field penuh hanya diambil lewat `get_source()` saat teks benar-benar dibutuhkan (chat, recommender, reindex).

---

## 2. `training_sessions` — Sesi roleplay aktif (sementara)

Cache write-through untuk percakapan roleplay yang sedang berlangsung. Primer disimpan in-process (dict Python, cepat, tanpa I/O); ditulis ke Firestore sebagai cadangan supaya sesi bertahan kalau proses backend di-restart (relevan di hosting gratis yang bisa sleep, mis. HF Spaces).

| Field | Tipe | Deskripsi |
|---|---|---|
| `id` | string | uuid4 hex, sama dengan doc id |
| `persona_id` | string | ID persona tetap (lihat `personas.py`), atau `"custom"` |
| `persona` | object \| null | Persona custom lengkap (dibangun via `build_custom()`) — disimpan inline karena tidak ada entri di katalog `PERSONAS` untuk dicari ulang |
| `drill_id` | string \| null | ID drill jika sesi berasal dari drill |
| `module_id` | string \| null | ID modul Learning Path jika sesi berasal dari modul (fitur dorman di UI, lihat PRD §5) |
| `focus_dimension` | string \| null | Dimensi skill yang ditekan (dari drill/modul) |
| `started_at` / `touched_at` | float (unix timestamp) | Untuk garbage collection (TTL 4 jam, `SESSION_TTL_SECONDS`) |
| `history` | array of `{role: "user"\|"assistant", content: string}` | Transkrip percakapan berjalan |

Dokumen ini **dihapus** begitu sesi berakhir (`POST /api/training/end`) — bukan arsip permanen. Riwayat permanen ada di `users/{uid}/attempts`.

---

## 3. `users/{uid}` — Ringkasan progres per FA (denormalized)

Doc id = Firebase `uid`. Field ini di-*refresh* (merge) setiap kali sesi roleplay selesai dievaluasi (`progress._update_summary`), sehingga leaderboard & manager dashboard tinggal baca koleksi ini tanpa perlu scan semua `attempts`.

| Field | Tipe | Deskripsi |
|---|---|---|
| `uid` | string | Firebase UID (sama dengan doc id) |
| `name` | string | Nama tampilan dari profil Google |
| `email` | string | Email akun Google |
| `picture` | string (URL) | Foto profil Google |
| `total_sessions` | int | Total sesi roleplay yang sudah dievaluasi |
| `total_xp` | int | Total XP kumulatif (dihitung, **tidak ditampilkan di UI** — lihat PRD §6) |
| `level` | int | `total_xp // 120 + 1` (dihitung, tidak ditampilkan) |
| `averages` | map `{dimensi: float}` | Rata-rata skor per 5 dimensi sepanjang waktu |
| `last_overall` | int | Skor overall sesi terakhir |
| `weakest_dimension` | string | Dimensi dengan rata-rata terendah saat ini |
| `updated_at` | string (ISO 8601 UTC) | Waktu refresh terakhir |

Dipakai oleh:
- **Leaderboard** (`GET /api/training/leaderboard`) — ranking berdasarkan rata-rata dari 5 nilai di `averages` (bukan `total_xp`), dengan `total_sessions` sebagai tie-break.
- **Manager dashboard** (`GET /api/admin/overview`) — agregat lintas semua `users`.

Filter `LEADERBOARD_HIDDEN` (env, cocok by nama tampilan atau email, case-insensitive) menyembunyikan baris tertentu dari leaderboard **tanpa menghapus datanya**.

---

## 4. `users/{uid}/attempts/{attemptId}` — Riwayat sesi roleplay (permanen)

Satu dokumen = satu sesi roleplay yang selesai dan berhasil dievaluasi (atau gagal-tapi-cukup-panjang-untuk-disimpan sebagai fallback). Doc id = uuid4 hex.

| Field | Tipe | Deskripsi |
|---|---|---|
| `id` | string | Sama dengan doc id |
| `persona_id` | string | ID persona yang dimainkan |
| `persona_name` | string | Nama tampilan persona saat itu (di-snapshot, tahan terhadap perubahan katalog persona di kemudian hari) |
| `drill_id` | string \| null | ID drill (jika ada) |
| `module_id` | string \| null | ID modul Learning Path (jika ada) — dipakai `curriculum.build_path()` untuk menentukan modul lulus/terkunci |
| `focus_dimension` | string \| null | Dimensi fokus drill/modul |
| `rapport`, `discovery`, `product_knowledge`, `objection_handling`, `closing` | int (1–10) | Skor per dimensi dari evaluasi LLM |
| `overall_score` | int (1–10) | Skor keseluruhan |
| `strengths` | array\<string\> | Poin kekuatan FA di sesi ini |
| `improvements` | array\<string\> | Poin yang perlu diperbaiki |
| `next_focus` | string | Saran fokus latihan berikutnya (kalimat) |
| `transcript` | array of `{role, content}` | Transkrip lengkap percakapan |
| `turn_count` | int | Jumlah giliran FA (pesan `role: "user"`) |
| `xp_earned` | int | `overall_score * 10 + min(turn_count, 10) * 2` — dihitung, tidak ditampilkan langsung ke FA sebagai angka XP di UI utama |
| `created_at` | string (ISO 8601 UTC) | Timestamp penyelesaian sesi — dipakai untuk hitung **streak** (hari berturut-turut dengan ≥1 attempt) |

Field ini adalah **satu-satunya sumber kebenaran** untuk semua turunan gamifikasi (streak, level, badge, tren, rekomendasi) — semuanya dihitung on-read di `progress.py`, tidak ada state ganda yang perlu disinkronkan.

### Badge yang diturunkan dari `attempts` (tidak disimpan sebagai field terpisah)

| Badge id | Syarat |
|---|---|
| `first_pitch` | ≥1 sesi |
| `regular` | ≥10 sesi |
| `veteran` | ≥25 sesi |
| `streak_3` / `streak_7` | Streak 3 / 7 hari |
| `tough_crowd` | Pernah main persona `skeptical_owner` |
| `high_roller` | Pernah main persona `legacy_planner` |
| `closer` | Skor `closing` terbaik ≥8 |
| `listener` | Skor `discovery` terbaik ≥9 |
| `ace` | `overall_score` terbaik ≥9 |
| `graduate` | Semua modul Learning Path lulus (fitur dorman) |

---

## 5. Data yang TIDAK disimpan di Firestore

- **Persona, drill, dan modul** — didefinisikan sebagai konstanta Python (`personas.py`, `drills.py`, `curriculum.py`), bukan data dinamis. Menambah persona/drill baru = ubah kode, bukan CRUD data.
- **Konten dokumen produk yang dipakai saat runtime chat** — teks penuh disimpan di `sources.text` (Firestore) TAPI di-cache in-memory di proses backend (`rag.py`) untuk performa; Firestore hanya sumber rehydrate saat startup.
- **Rate-limit counter** (`ratelimit.py`) — in-memory saja, per-proses, reset saat restart (bukan didesain untuk akurasi multi-instance).

---

## 6. Indeks & Query Pattern

Firestore query yang dipakai:
- `sources`: `order_by("created_at", DESCENDING)`, `where("status", "==", "ready")` — keduanya index tunggal (auto).
- `users/{uid}/attempts`: `order_by("created_at")` — index tunggal (auto).
- `users`: `stream()` penuh (tanpa filter) untuk leaderboard/manager overview — dapat menjadi bottleneck jika jumlah FA sangat besar (ratusan ribu); untuk skala organisasi BCA Life saat ini (puluhan–ratusan FA) ini masih murah dan sederhana.

Tidak ada composite index custom yang perlu didaftarkan secara manual di Firebase Console berdasarkan query yang ada saat ini.
