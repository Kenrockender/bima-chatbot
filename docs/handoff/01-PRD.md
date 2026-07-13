# PRD — Sera (dahulu BIMA)
### AI Sales-Coaching & Product-Knowledge Platform untuk Financial Advisor BCA Life

**Versi dokumen:** 1.0 · **Tanggal:** 2026-07-13 · **Status:** Live (backend HF Spaces, frontend Vercel)

---

## 1. Latar Belakang & Masalah

Financial Advisor (FA) baru BCA Life butuh dua hal yang selama ini terpisah:

1. **Pengetahuan produk** — brosur/RIPLAY produk BCA Life & kompetitor tersebar, sulit dicari cepat saat butuh jawab pertanyaan nasabah.
2. **Jam terbang pitching** — kemampuan membangun rapport, menggali kebutuhan, menjawab keberatan, dan closing hanya bisa diasah lewat pengalaman nyata di depan nasabah — yang mahal (reputasi, waktu) kalau gagal.

Sera menjawab keduanya dalam satu aplikasi: chatbot tanya-jawab berbasis dokumen, **dan** simulator roleplay nasabah AI dengan evaluasi & coaching instan — didesain meniru pola "Stimuler" (AI coaching feedback loop) tapi untuk konteks sales asuransi.

## 2. Visi Produk

> "Stimuler untuk sales asuransi" — FA berlatih pitching ke persona nasabah AI yang realistis, mendapat feedback granular per-giliran, dan skornya terekam sebagai progres jangka panjang yang bisa dilihat diri sendiri maupun manajer tim.

## 3. Target Pengguna

| Peran | Kebutuhan |
|---|---|
| **FA baru** (onboarding) | Belajar produk cepat; tempat aman untuk gagal & coba lagi sebelum ketemu nasabah asli |
| **FA berpengalaman** | Asah skill spesifik (closing, objection handling) lewat drill singkat; siapkan comparison sheet vs kompetitor untuk nasabah tertentu |
| **Manager/Team Lead** | Lihat rata-rata skor tim, siapa yang butuh coaching di dimensi apa, tanpa mendengarkan rekaman panggilan asli |
| **Admin IT/Trainer** | Kelola dokumen produk yang jadi basis pengetahuan (upload PDF/PPTX, tandai insurer) |

## 4. Ruang Lingkup Fitur (Live)

### 4.1 Onboarding Q&A Chatbot (`/`, mode chat biasa)
- Tanya-jawab bebas berbasis dokumen produk BCA Life + kompetitor (Manulife, Prudential, AIA, MSIG Life).
- Jawaban dikelompokkan per penerbit; produk BCA Life diprioritaskan/dijadikan pengarah balik ("PRODUK KAMI" vs "KOMPETITOR").
- Toggle bahasa EN/ID; kutip sumber; kartu eskalasi (WhatsApp/email) kalau tidak ada jawaban di dokumen.

### 4.2 Roleplay Sales Training (`/`, mode latihan)
- FA memilih **persona nasabah** (7 persona tetap + 1 custom persona yang diisi FA sendiri) dan mengobrol via chat/voice.
- Sera menjawab in-character sebagai calon nasabah — bukan asisten, bukan penjual — sesuai kepribadian & tingkat kesulitan persona.
- **Live coaching**: setiap beberapa giliran, chip feedback singkat (`good` / `watch` / `tip`) muncul, ditandai per dimensi skill. Digating secara heuristik supaya tidak setiap giliran memicu panggilan LLM tambahan (hemat biaya).
- **End-of-session report**: skor 1–10 di 5 dimensi (rapport, discovery, product knowledge, objection handling, closing), overall score, strengths/improvements, saran fokus latihan berikutnya — dievaluasi oleh LLM dengan rubrik anchor eksplisit dan divalidasi terhadap fakta produk (product_facts) supaya klaim FA yang salah dinilai turun.
- **Voice**: push-to-talk mic (tanpa auto-stop by silence — pernah dicoba, dimatikan karena sering salah pencet). STT server-side (Groq Whisper) untuk fallback iOS/Safari; TTS ElevenLabs dengan suara sesuai gender persona, di-cache in-memory untuk hemat biaya per-karakter.

### 4.3 Drills (Latihan Fokus)
- 5 drill singkat, masing-masing mengunci 1 persona + 1 dimensi skill + `focus_note` yang membuat persona menekan skill itu secara spesifik (mis. Pak Budi menolak dengar produk apa pun sampai FA benar-benar bertanya).
- Dibuka lewat `DrillBriefing` — kartu situasi + misi, bukan drop langsung ke chat kosong.

### 4.4 Progress Dashboard (`/progress`)
- Streak harian (dipertahankan by design — lihat §6), rata-rata skor per dimensi, tren 8 sesi terakhir, badge pencapaian, rekomendasi sesi berikutnya berdasarkan dimensi terlemah.
- **XP & Level dihitung di backend tapi TIDAK ditampilkan di UI** — keputusan produk eksplisit untuk mengurangi kesan "game poin" dan fokus ke kualitas latihan (lihat §6).

### 4.5 Leaderboard (`/leaderboard`)
- Ranking FA berdasarkan **rata-rata skor** (bukan total XP/sesi), dengan jumlah sesi sebagai info pendukung/tie-break.
- Akun demo milik owner disembunyikan dari ranking (tanpa menghapus datanya) via `LEADERBOARD_HIDDEN`.
- Signature title otomatis dari dimensi terkuat FA (mis. "Closer", "Deep Listener") setelah ≥3 sesi.

### 4.6 Manager Dashboard (`/manager`, admin-only)
- Rata-rata tim per dimensi, dimensi terlemah tim, daftar anggota dengan skor terakhir & waktu aktif terakhir — dibaca dari satu koleksi ringkasan (bukan scan semua attempt).

### 4.7 Product Recommender & Competitor Comparison (`/recommend`)
- Form profil nasabah (usia, gender, tanggungan, penghasilan, budget premi, tujuan, horizon) → rekomendasi produk BCA Life + perbandingan kompetitor sejenis + skrip jualan lengkap (opening, discovery questions, pitch, keunggulan, objection handling, closing) — semuanya JSON terstruktur dari satu panggilan LLM.
- Perbandingan head-to-head/complementary satu-lawan-satu vs dokumen kompetitor (dari katalog yang sudah di-ingest, atau upload ad-hoc tanpa perlu masuk knowledge base).

### 4.8 Admin Panel (`/admin`, admin-only)
- Upload PDF/PPTX atau tambah URL sebagai sumber pengetahuan; status processing → ready/failed; hapus & reindex.
- Upload FA ditandai insurer `BCA Life` otomatis (dokumen kompetitor masuk lewat seeding, bukan upload admin).

## 5. Fitur yang Ada di Backend tapi Dorman (tidak ditampilkan di UI)

- **Learning Path / Kurikulum** (`backend/app/curriculum.py`, endpoint `GET /api/training/curriculum`): 8 modul progresif dengan mastery gate per dimensi, mengunci modul berikutnya sampai modul sebelumnya lulus. UI-nya (`/learn`, nav "Kelas") **dihapus 2026-07-07** atas keputusan produk untuk menyederhanakan navigasi — kode backend sengaja dibiarkan hidup supaya bisa diaktifkan lagi tanpa perubahan backend.

## 6. Keputusan Produk yang Mengikat (jangan diubah tanpa diskusi ulang)

1. Mic **manual push-to-talk** — jangan tambahkan auto-send berbasis deteksi hening; pernah dicoba dan sering salah pencet.
2. **Streak dipertahankan, XP & Level disembunyikan** dari seluruh UI (progress hero, feedback report, leaderboard, manager dashboard). Backend tetap menghitung XP secara internal (tidak mengganggu, hanya tidak ditampilkan).
3. Leaderboard **ranking berdasarkan rata-rata skor**, bukan total XP.
4. Drill harus selalu membawa briefing situasi + misi — tidak boleh drop FA ke chat kosong tanpa konteks.
5. Model LLM default tetap murah (Claude Haiku 4.5 lewat OpenRouter) kecuali ada alasan kuat untuk task tertentu (lihat env `OPENROUTER_COACH_MODEL` / `OPENROUTER_EVAL_MODEL`).

## 7. Metrik Keberhasilan (indikatif — belum ada instrumentasi analytics formal)

- Jumlah sesi roleplay per FA per minggu (proxy: `total_sessions` di `users/{uid}`).
- Streak rata-rata tim.
- Kenaikan rata-rata skor per dimensi dari waktu ke waktu (`averages` di summary FA).
- Tingkat penggunaan recommender/comparison sebelum kunjungan nasabah nyata (belum diinstrumentasi — perlu event logging kalau mau diukur serius).

## 8. Non-Goals (sengaja di luar cakupan saat ini)

- Tidak ada rekaman panggilan nasabah asli / integrasi CRM.
- Tidak ada leaderboard lintas cabang/wilayah — hanya satu populasi flat.
- Tidak ada pembayaran/reward finansial berbasis leaderboard.
- Tidak ada mobile native app — web responsive saja (Next.js).

## 9. Risiko & Batasan yang Diketahui

- **Biaya LLM per karakter** untuk ElevenLabs TTS — dicache in-memory (LRU 128 entri) tapi tetap perlu dipantau kalau trafik naik.
- **Evaluasi akhir sesi bisa gagal parsing JSON** (LLM output tidak valid) — sistem retry 3x, lalu fallback ke laporan kosong dengan pesan error; percobaan tetap disimpan kalau turn count cukup.
- **Free-tier hosting** (HF Spaces) bisa sleep/restart — sesi aktif di-write-through ke Firestore supaya bisa di-rehydrate, tapi ini menambah latensi tiap giliran chat.
- Backend adalah **satu-satunya klien Firestore** (frontend tidak pernah bicara langsung ke Firestore) — desain yang harus dipertahankan demi keamanan data.
