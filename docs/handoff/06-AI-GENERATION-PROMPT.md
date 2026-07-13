# AI Generation Prompt — Panduan Membangun Ulang Sera Secara Bertahap

Dokumen ini berisi rangkaian prompt yang bisa ditempel langsung ke AI coding agent (Claude Code, Cursor, dsb.) untuk membangun ulang aplikasi Sera dari nol, tahap demi tahap. Urutannya mengikuti bagaimana aplikasi ini **benar-benar berevolusi** (bukan disain besar sekaligus) — tiap tahap menghasilkan aplikasi yang jalan penuh sebelum lanjut ke tahap berikutnya. Jalankan satu tahap, verifikasi (jalankan app, coba fitur), baru lanjut ke prompt berikutnya.

**Prasyarat sebelum mulai:** siapkan API key OpenRouter, project Firebase (Firestore + Google Auth), dan (opsional) API key ElevenLabs & Groq. Lihat [04-TECH-STACK-SETUP.md](04-TECH-STACK-SETUP.md).

---

## Tahap 0 — Skeleton Proyek

```
Buatkan skeleton monorepo untuk aplikasi "Sera": backend FastAPI (Python) di folder
backend/ dan frontend Next.js 16 App Router (TypeScript + Tailwind CSS 4) di folder
frontend/. Sertakan:
- backend/app/main.py dengan endpoint GET /health, CORS middleware yang membaca
  origin dari env CORS_ORIGINS
- backend/app/config.py pakai pydantic-settings (BaseSettings) untuk semua
  environment variable, satu class Settings, instance singleton `settings`
- backend/requirements.txt: fastapi, uvicorn[standard], pydantic, pydantic-settings,
  python-dotenv, httpx
- frontend/package.json: next, react, react-dom, tailwindcss, typescript
- docker-compose.yml yang menjalankan keduanya
- README singkat cara jalanin lokal
Jangan tambahkan fitur lain dulu — ini murni skeleton yang bisa `docker compose up`
dan menampilkan halaman kosong + /health merespons {"status":"ok"}.
```

## Tahap 1 — Chat Q&A Berbasis Dokumen (tanpa vector DB)

```
Tambahkan fitur chat Q&A yang menjawab HANYA dari kumpulan dokumen produk yang
di-stuff penuh ke prompt LLM (skip vector search — asumsikan knowledge base kecil,
puluhan ribu token total).

Backend:
- app/rag.py: fungsi `documents_block()` yang menggabungkan semua dokumen ready
  jadi satu blok teks, dikelompokkan per "insurer" (mis. "PENERBIT: BCA Life
  (PRODUK KAMI)" vs "(KOMPETITOR)"), dengan safety valve `max_docs_block_chars`
  yang membuang dokumen kompetitor (terbesar dulu) kalau kepanjangan — dokumen
  milik kami sendiri selalu dipertahankan penuh.
  Fungsi `answer(message, history, lang)` yang panggil LLM via OpenRouter
  (OpenAI-compatible endpoint) memakai langchain-openai, system prompt berisi
  documents_block(), instruksi jawab hanya dari dokumen + kutip sumber + kalau
  tidak ketemu jawaban kembalikan fallback=true dengan kartu eskalasi
  (WhatsApp/email dari env).
  Deteksi bahasa otomatis EN/ID pakai langdetect kalau `lang` tidak dikirim.
- app/db.py: CRUD sederhana untuk koleksi sumber dokumen (nama, tipe pdf/url,
  insurer, status processing/ready/failed, teks terekstrak) — pakai in-memory
  dict dulu di tahap ini (Firestore ditambahkan Tahap 3).
- app/routes_chat.py: POST /api/chat menerima {message, history[], lang?},
  kembalikan {answer, sources[], lang, fallback, escalation?}.
- Endpoint admin dasar untuk upload PDF (pakai pdfplumber untuk ekstraksi teks)
  dan tambah URL (beautifulsoup4 + requests) sebagai sumber baru, semua ditandai
  status "processing" lalu "ready"/"failed" di background task FastAPI.

Frontend:
- Halaman "/" dengan input chat sederhana, riwayat percakapan, toggle EN/ID,
  render markdown jawaban (react-markdown + remark-gfm), tampilkan sumber yang
  dikutip, dan kartu eskalasi kalau fallback=true.
- Halaman "/admin" (belum perlu auth di tahap ini) untuk upload PDF/tambah URL
  dan lihat status tiap sumber.

Verifikasi: upload 1-2 PDF produk contoh, tanya sesuatu yang ada di PDF itu,
pastikan jawaban mengutip sumber dan tidak mengarang di luar dokumen.
```

## Tahap 2 — Rate Limiting

```
Tambahkan rate limiter in-memory sederhana (app/ratelimit.py) sebagai FastAPI
dependency `RateLimiter(key, max_calls, per_seconds)` — sliding window per key,
disimpan di dict Python dengan lock thread-safe. Pasang di POST /api/chat
(40 calls/60s) supaya satu klien tidak bisa spam biaya LLM.
```

## Tahap 3 — Migrasi ke Firebase (Auth + Firestore)

```
Migrasikan penyimpanan dari in-memory ke Cloud Firestore, dan tambahkan login
Google via Firebase Auth. PENTING: desainnya "backend-mediated" — backend
adalah satu-satunya klien Firestore; frontend HANYA memakai Firebase untuk
autentikasi (ambil ID token), lalu kirim `Authorization: Bearer <token>` ke
setiap API call yang perlu identitas.

Backend:
- app/firebase.py: init firebase-admin secara lazy & thread-safe (RLock),
  credential dari env FIREBASE_SERVICE_ACCOUNT (inline JSON) atau
  FIREBASE_SERVICE_ACCOUNT_FILE (path), fungsi fs() (Firestore client) dan
  verify_token(id_token).
- app/auth.py: dependency get_current_user() yang verifikasi Bearer token,
  kembalikan {uid, email, name, picture, admin}. admin=true kalau custom claim
  `admin` ATAU email ada di env ADMIN_EMAILS. Tambahkan opsi ALLOWED_EMAIL_DOMAINS
  untuk membatasi domain email yang boleh login (403 kalau tidak cocok, kosong
  = izinkan semua). Dependency require_admin() yang 403 kalau bukan admin.
- Pindahkan koleksi `sources` (dari Tahap 1) ke Firestore — field: name, type,
  insurer, origin, status, error, page_count, text, created_at, updated_at.
  Listing publik jangan sertakan field `text` (berat) demi performa.
- Endpoint admin sekarang pakai `Depends(require_admin)`, bukan password header.
- Saat startup, rehydrate cache in-memory dokumen dari semua source Firestore
  berstatus "ready" (thread background, tidak blocking startup).

Frontend:
- lib/firebase.ts: init Firebase client SDK, expose signInWithGoogle/signOut.
- components/AuthProvider.tsx + AuthGate.tsx: context user + proteksi halaman
  yang butuh login.
- Semua fetch ke backend menyertakan header Authorization dari
  currentUser.getIdToken().

Verifikasi: login Google, upload PDF baru sebagai admin, restart backend,
pastikan dokumen tetap ada (rehydrate dari Firestore berjalan).
```

## Tahap 4 — Engine Roleplay Sales Training

```
Ini pivot produk terbesar: dari "chatbot Q&A" menjadi "simulator roleplay nasabah
AI untuk latihan sales". LLM sekarang berperan sebagai CALON NASABAH yang
diprospek oleh pengguna (Financial Advisor/FA), bukan asisten yang menjawab.

Backend:
- app/personas.py: definisikan 6-8 persona nasabah tetap (const list of dict):
  id, name, title, summary, challenge (Mudah/Sedang/Sulit), accent (warna hex),
  gender (m/f), opening (kalimat pembuka persona), persona_prompt (system prompt
  lengkap: latar belakang, karakter, cara membalas — SEMUA dalam bahasa yang
  sama dengan target pengguna). Tambahkan 1 persona id="custom" dengan
  persona_prompt kosong — dibangun on-the-fly dari input FA (nama, latar
  belakang, kebutuhan, gender, tingkat kesulitan) lewat fungsi build_custom().
- app/sessions.py: session store untuk roleplay aktif — in-memory dict (fast
  path) DAN write-through ke Firestore koleksi `training_sessions` (best-effort,
  supaya sesi bertahan kalau proses backend di-restart di hosting gratis).
  TTL garbage collection ~4 jam. API: create(), get(), append(), end().
- app/training.py — jantung fitur:
  - start_session(persona_id, ...) → buat session, kembalikan opening_message.
  - reply(session_id, fa_message) → panggil LLM dengan system prompt =
    persona_prompt + FAKTA_PRODUK (documents_block dari Tahap 1, supaya nasabah
    AI "kebetulan tahu" brosur produk untuk menguji akurasi klaim FA) + aturan
    format ketat (satu paragraf, tanpa bullet/markdown, maks beberapa kalimat,
    JANGAN pernah mengaku AI, JANGAN jual balik). Tandai system prompt sebagai
    prompt-cache breakpoint (stabil sepanjang sesi) supaya turn ke-2+ murah.
    Sanitasi output defensif (strip bullet/quote residual) sebelum dikirim ke FA.
  - end_session(session_id) → keluar dari peran, evaluasi transkrip lengkap
    dengan LLM terpisah memakai rubrik skor 1-10 di 5 DIMENSI EKSPLISIT:
    rapport, discovery, product_knowledge, objection_handling, closing — SERTAKAN
    ANCHOR SKOR di system prompt evaluator (contoh: "1-3: langsung jualan tanpa
    basa-basi, 7-8: hangat & personal, 9-10: bangun trust tulus") supaya skor
    konsisten antar sesi. Output WAJIB JSON ketat: {scores, overall_score,
    strengths[], improvements[], next_focus}. Retry parsing JSON sampai 3x kalau
    LLM keluar format salah; fallback ke laporan kosong dengan pesan error kalau
    tetap gagal.
- routes_training.py: POST /api/training/start, /chat, /end; GET /personas.

Frontend:
- Halaman "/" bertambah mode "Latihan": kartu pilih persona (PersonaCard),
  bubble chat (ChatBubble), dan setelah "Akhiri Sesi" tampilkan FeedbackReport
  (skor 5 dimensi + strengths/improvements + next_focus).

Verifikasi: pilih 1 persona, coba jual sesuatu tanpa bertanya kebutuhan dulu —
pastikan persona menolak/skeptis sesuai karakternya, bukan malah membantu jualan.
Akhiri sesi, pastikan laporan skor masuk akal dan konsisten dengan performa di
percakapan.
```

## Tahap 5 — Live Coaching Per-Giliran

```
Tambahkan feedback instan SETIAP giliran FA (bukan hanya di akhir sesi), tapi
JANGAN panggil LLM coaching di setiap giliran — buat heuristik Python murah
(regex untuk deteksi kata kunci objection/harga/closing, cek apakah ini giliran
pertama, cek apakah barusan ada objection dari customer) yang menentukan giliran
mana yang "layak dilatih" (should_coach). Baru untuk giliran yang lolos gate,
panggil LLM kedua secara PARALEL dengan LLM balasan customer (pakai
ThreadPoolExecutor, 2 workers) — supaya total latensi = max(reply, coach), bukan
penjumlahan. Coach LLM output JSON singkat: {verdict: good|watch|tip, dimension,
note (maks ~12 kata)}. Attach ke response /api/training/chat sebagai field
`coach` (nullable). Tampilkan sebagai chip kecil (CoachChip) di UI chat.
Sasaran: gate memotong ~60-70% panggilan coach tanpa kehilangan momen penting
(tetap selalu coach giliran pertama, pertanyaan, bahasan harga/closing, dan
respons setelah customer keberatan).
```

## Tahap 6 — Progress, Streak, Badge (TANPA XP/Level di UI)

```
Tambahkan tracking progres FA jangka panjang, derived-on-read dari riwayat sesi
— jangan simpan state ganda yang perlu disinkronkan manual.

Backend:
- Setiap sesi yang selesai dievaluasi, simpan sebagai dokumen baru di Firestore
  users/{uid}/attempts/{attemptId}: persona_id, persona_name, skor 5 dimensi,
  overall_score, strengths, improvements, next_focus, transcript, turn_count,
  xp_earned (hitung: overall_score*10 + min(turn_count,10)*2), created_at (ISO).
- app/progress.py, semua dihitung on-read dari koleksi attempts:
  - streak(): hari berturut-turut (berakhir hari ini atau kemarin) dengan ≥1 sesi.
  - averages per dimensi, trend 8 sesi terakhir, weakest/strongest dimension.
  - level = total_xp // 120 + 1 (dihitung tapi CATAT: ini TIDAK akan ditampilkan
    di UI utama — lihat instruksi khusus di bawah).
  - badge catalog (first_pitch, regular 10x, veteran 25x, streak_3, streak_7,
    tough_crowd untuk persona tersulit, closer skor closing≥8, dst.) — dihitung
    dari attempts, bukan field tersimpan terpisah.
  - recommend_next(): map dimensi terlemah FA → persona yang paling cocok
    melatih dimensi itu.
- Setelah tiap attempt tersimpan, refresh dokumen ringkasan users/{uid} (merge):
  total_sessions, total_xp, level, averages, last_overall, weakest_dimension,
  name/email/picture dari profil Google — supaya nanti leaderboard/manager
  dashboard baca satu dokumen ringkas, bukan scan semua attempts.
- GET /api/training/progress, /history, /next.

Frontend:
- Halaman "/progress": tampilkan STREAK (hari), rata-rata skor per dimensi
  (chart sederhana), tren, badge yang sudah didapat, kartu "latihan berikutnya"
  (dari recommend_next).

AWAS — keputusan produk yang WAJIB diikuti: JANGAN tampilkan XP atau Level di
mana pun di UI (progress hero, feedback report, atau halaman lain). Cukup
tampilkan STREAK. Backend boleh tetap menghitung XP/level secara internal
(tidak masalah, hanya tidak disurface) — ini untuk menghindari kesan "aplikasi
game berpoin" dan menjaga fokus ke kualitas latihan asli.
```

## Tahap 7 — Drill Fokus (Latihan Bite-Sized)

```
Tambahkan mode latihan singkat yang menekan SATU skill spesifik, bukan roleplay
bebas penuh.

Backend:
- app/drills.py: const list ~5 drill, masing-masing: id, title, dimension
  (salah satu dari 5 dimensi), persona_id (pinjam dari katalog persona), summary,
  objective (kalimat tujuan latihan untuk ditampilkan ke FA SEBELUM mulai),
  focus_note (instruksi tambahan yang di-append ke system prompt persona supaya
  customer menekan skill itu secara spesifik — mis. untuk drill discovery:
  "jangan mau dengar produk apa pun sampai FA benar-benar bertanya dulu").
- training.start_session() menerima drill_id opsional: kalau ada, override
  persona_id dari drill dan set focus_dimension; _customer_system() meng-append
  focus_note ke system prompt.
- end_session() menyertakan drill_id & focus_dimension di laporan akhir.
- GET /api/training/drills.

Frontend:
- Sebelum masuk chat, tampilkan DrillBriefing card: Situasi (dari summary) +
  Misi Kamu (dari objective) + tombol "Mulai Drill". JANGAN langsung drop FA
  ke chat kosong tanpa konteks — briefing ini WAJIB ada, itu keputusan produk
  yang membedakan drill dari sekadar roleplay bebas dengan persona tertentu.
```

## Tahap 8 — Learning Path / Kurikulum Progresif (Opsional)

```
Tambahkan struktur kurikulum di atas mekanisme drill: 8 modul berurutan
(rapport → discovery → product knowledge → objection handling → closing),
dikelompokkan jadi 5 stage, masing-masing modul punya "mastery gate" (skor
minimum dimensi tertentu yang harus dicapai untuk lulus, kadang juga
overall_min).

Backend:
- app/curriculum.py: const list MODULES mirip drill (id, stage, order, title,
  dimension, persona_id, summary, objective, focus_note, gate:
  {dimension, min_score, overall_min?}).
- training.start_session() menerima module_id opsional (prioritas di atas
  drill_id kalau keduanya ada), stempel module_id ke attempt yang tersimpan
  supaya kelulusan modul EKSAK (bukan heuristik cocok persona/skor kebetulan
  di sesi bebas) — attempt_clears_gate() cek skor attempt vs gate modul.
- build_path(rows): derive status tiap modul (attempts, best_score, passed,
  unlocked) dari attempts milik FA — modul pertama selalu unlocked, modul
  berikutnya unlocked hanya setelah modul sebelumnya passed.
- GET /api/training/curriculum.
- end_session() menyertakan report["module"] kalau sesi berasal dari modul,
  supaya UI bisa rayakan kelulusan modul di laporan akhir sesi.

Frontend:
- Halaman "/learn": stage headers dengan progress count, kartu tiap modul
  (terkunci/terbuka/lulus), tombol "Lanjutkan" deep-link ke "/?module=<id>".
- Kartu ringkas kurikulum di halaman "/progress" (progress bar keseluruhan +
  modul berikutnya).

Catatan: fitur ini BOLEH ditunda atau dibuat dorman (backend hidup, tanpa
halaman UI) kalau prioritas produk lebih ke roleplay bebas + drill saja —
itulah yang sebenarnya terjadi di versi produksi Sera saat ini.
```

## Tahap 9 — Leaderboard & Manager Dashboard

```
Backend:
- progress.leaderboard(current_uid): baca semua dokumen users/{uid} yang
  total_sessions>0, urutkan berdasarkan RATA-RATA SKOR (mean 5 dimensi) —
  BUKAN total XP — dengan total_sessions sebagai tie-break. Beri signature
  title otomatis dari dimensi terkuat FA (mis. "Closer") setelah ≥3 sesi.
  Sediakan mekanisme sembunyikan FA tertentu dari ranking by nama/email
  (env, case-insensitive) TANPA menghapus datanya — untuk akun demo internal.
- progress.team_overview(): agregat rata-rata tim per dimensi, dimensi
  terlemah tim, daftar member dengan skor terakhir & waktu update — untuk
  manager yang butuh tahu siapa butuh coaching di dimensi apa.
- GET /api/training/leaderboard (auth biasa), GET /api/admin/overview
  (admin only).

Frontend:
- "/leaderboard": tabel ranking, highlight baris milik user sendiri.
- "/manager" (admin only): rata-rata tim per dimensi + tabel anggota.

Keputusan produk WAJIB: leaderboard urut berdasarkan RATA-RATA SKOR, bukan
total XP atau jumlah sesi — supaya tidak menghargai "grinding" kuantitas di
atas kualitas latihan.
```

## Tahap 10 — Voice: Push-to-Talk Mic + TTS/STT Server-Side

```
Backend:
- POST /api/training/tts: terima {text, gender}, pilih voice ElevenLabs sesuai
  gender persona (dua env var voice id terpisah: female/male), panggil
  ElevenLabs text-to-speech API, cache hasil audio in-memory (LRU, keyed by
  hash dari voice+model+speed+text) supaya kalimat berulang tidak bayar
  per-karakter dua kali. Kembalikan audio/mpeg dengan header Cache-Control
  immutable jangka panjang (teks yang sama selalu menghasilkan audio yang sama).
- POST /api/training/stt/transcribe: terima file audio, forward ke Groq Whisper
  API, kembalikan {text}. Ini FALLBACK untuk browser yang tidak dukung Web
  Speech API (terutama iOS/Safari) — bukan default utama.
- GET /tts/available & /stt/available: report apakah fitur ini aktif (API key
  terisi) supaya frontend bisa sembunyikan UI kalau tidak dikonfigurasi.

Frontend:
- hooks/useSpeech.ts: Web Speech API browser (default, gratis, tanpa API key).
- hooks/useServerTTS.ts: kalau backend report ElevenLabs aktif, pakai ini
  (supersede useSpeech) untuk suara jauh lebih natural.
- components/MicButton.tsx: PUSH-TO-TALK MANUAL — tekan untuk mulai rekam,
  tekan lagi untuk berhenti & kirim. JANGAN implementasikan auto-stop
  berdasarkan deteksi hening/silence — ini sudah dicoba di masa lalu dan
  SERING SALAH PENCET (memotong kalimat FA di tengah bicara), sehingga
  dihapus. Ini keputusan produk yang mengikat, bukan preferensi sementara.
```

## Tahap 11 — Product Recommender & Competitor Comparison

```
Backend:
- app/recommender.py:
  - build_narrative(profile): rangkai profil nasabah (usia, gender, tanggungan,
    penghasilan, budget premi, tujuan, horizon) jadi paragraf naratif Indonesia.
  - _catalog_block(): render seluruh produk BCA Life ready jadi satu blok teks
    (prefer fact sheet .md kondensasi kalau ada, fallback teks brosur penuh) —
    blok ini SAMA di setiap panggilan, taruh di system prompt (cache-friendly).
  - recommend(profile): satu panggilan LLM dengan system = instruksi + katalog,
    output JSON ketat: {customer_summary, bca_recommendations[] (per produk:
    fit_score, suggested_up/premium/tenor, rationale, concerns),
    competitor_comparisons[] (provider, produk sejenis, strengths,
    weaknesses_vs_bca), sales_script{opening, discovery_questions, pitch,
    competitive_advantages, objection_handling[], closing}}.
  - compare(competitor_id, bca_name/stem, mode): bandingkan SATU produk BCA
    Life vs SATU dokumen kompetitor yang sudah di-ingest. Model menentukan
    sendiri relationship "head_to_head" (produk sejenis, banding apple-to-apple)
    vs "complementary" (beda jenis, BCA Life melengkapi bukan menggantikan) —
    kecuali mode dipaksa eksplisit. Output termasuk spec_rows perbandingan per
    dimensi dengan flag advantage bca/competitor/tie.
  - compare_uploaded(...): varian yang menerima file kompetitor diunggah
    ad-hoc (diekstrak lalu dibuang, TIDAK di-ingest ke knowledge base permanen)
    — supaya FA bisa cepat bandingkan tanpa perlu admin onboarding dokumen dulu.
- routes_recommender.py: POST /recommend, GET /competitors, POST /compare,
  POST /compare-upload (multipart file).

Frontend:
- "/recommend": form profil nasabah → render rekomendasi produk (kartu skor),
  tabel perbandingan kompetitor, dan skrip jualan siap pakai (bisa di-copy).
  Tambahkan mode compare satu-lawan-satu dengan dropdown kompetitor atau upload
  file.
```

## Tahap 12 — Deploy Production

```
Siapkan deploy dua sisi:
1. Backend sebagai Docker image ke Hugging Face Spaces (SDK: docker, port 8000)
   — pilih ini karena PaaS lain (Render/Railway/Fly/Koyeb) mensyaratkan kartu
   kredit yang bisa jadi blocker. Space builds dari root repo, jadi kalau
   backend adalah subfolder monorepo, gunakan `git subtree split --prefix=backend
   HEAD` lalu force-push ke remote Space sebagai deploy artifact terpisah
   (jangan pernah force-push ke branch riwayat kerja utama). Set semua secret
   (OPENROUTER_API_KEY, FIREBASE_SERVICE_ACCOUNT penuh, ELEVENLABS_API_KEY,
   STT_API_KEY, ADMIN_EMAILS, dst.) di Space Settings → Variables and secrets,
   BUKAN file .env yang ikut commit.
2. Frontend ke Vercel, auto-deploy dari branch utama, env NEXT_PUBLIC_FIREBASE_*
   dan NEXT_PUBLIC_API_BASE_URL diarahkan ke URL Space backend.
Tulis dokumen DEPLOY.md yang mencatat command persis, urutan langkah, dan
kegagalan umum (mis. CORS_ORIGINS belum diupdate, ID token expired, Space sleep
lalu cold-start lambat).
```

---

## Tips Menjalankan Prompt Ini dengan AI Coding Agent

1. **Satu tahap = satu commit/PR.** Jangan gabungkan beberapa tahap dalam satu sesi kalau ingin review yang bersih.
2. **Verifikasi manual tiap tahap** sebelum lanjut — terutama Tahap 4 (roleplay in-character) dan Tahap 6 (aturan XP/Level tersembunyi) karena keduanya adalah keputusan produk yang mudah dilanggar tanpa sadar oleh AI yang "membantu" menambahkan fitur.
3. **Salin ulang bagian "Keputusan produk WAJIB"** di setiap prompt lanjutan (mis. saat refactor Tahap 4-11) supaya AI agent yang baru (context baru/sesi baru) tidak diam-diam mengembalikan XP ke UI atau menambahkan auto-send mic.
4. Kalau memakai Claude Code atau agent serupa, tempel PRD ([01-PRD.md](01-PRD.md)) sebagai context tambahan di awal sesi supaya keputusan non-goals & batasan risiko ikut dipahami sebelum coding dimulai.
