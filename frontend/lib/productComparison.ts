// Curated product-comparison data for the BCA Life Advisor Cockpit.
//
// This replaces the profile-driven AI recommender for the comparison view: the
// FA picks a BCA Life product and gets a head-to-head against the closest
// competitors, plus a ready-to-use sales script. Content is hand-curated from
// the product fact sheets & brochures (backend/seed/BCA Life/*) so it is
// accurate, fast, and works without the backend LLM running.
//
// Sources:
//   - VALUE+    : "2026 - 06 - 08 Materi TTT VALUE+ 1" (full competitor section)
//   - Heritage+ : heritage-platinum-protection fact sheet (Keunggulan vs Kompetitor)
//   - STAR      : safety-guard-critical-cover fact sheet (Keunggulan vs Kompetitor)
//
// Content is in Bahasa Indonesia (the FA-facing language); only the UI chrome
// is translated. Products without a script yet expose `script: null`.

export type ObjectionHandling = {
  objection: string;
  response: string;
};

export type SalesScript = {
  opening: string;
  discoveryQuestions: string[];
  pitch: string;
  competitiveAdvantages: string[];
  objectionHandling: ObjectionHandling[];
  closing: string;
};

export type Competitor = {
  provider: string;
  productName: string;
  /** One line: why this is the head-to-head match for the BCA Life product. */
  headToHead: string;
  /** Honest competitor strengths. */
  strengths: string[];
  /** Where BCA Life wins. */
  weaknessesVsBca: string[];
};

export type ProductComparison = {
  id: string;
  name: string;
  shortName: string;
  type: string;
  positioning: string;
  /** Key specs / features the FA should know. */
  features: string[];
  /** Selling points to highlight. */
  strengths: string[];
  /** Honest watch-outs. */
  weaknesses: string[];
  competitors: Competitor[];
  /** Sales script — null means "in progress". */
  script: SalesScript | null;
  /** Marks the fully-built prototype product. */
  prototype?: boolean;
};

// ---------------------------------------------------------------------------
// VALUE+ — fully-built prototype (comparison + sales script)
// ---------------------------------------------------------------------------

const VALUE_PLUS: ProductComparison = {
  id: "value-plus",
  name: "Value Income Assurance (VALUE+)",
  shortName: "VALUE+",
  type: "Asuransi Jiwa Dwiguna Kombinasi · IDR & USD",
  positioning:
    "Dana multiguna fleksibel untuk masa depan keluarga + proteksi 20 tahun, dengan akseptasi dijamin tanpa pemeriksaan kesehatan.",
  features: [
    "Masa Pertanggungan 20 tahun; Masa Pembayaran Premi 5 atau 10 tahun.",
    "Guaranteed Acceptance — tanpa pemeriksaan kesehatan.",
    "Premi min. Rp50 jt/th (5 pay) atau Rp25 jt/th (10 pay); maks. Rp550 jt/th.",
    "Manfaat Akhir Masa Pertanggungan hingga 1.790% Premi Dasar disetahunkan (Plan Core, 10 pay).",
    "Opsi Manfaat Tunai Tahunan hingga 25% premi disetahunkan (Plan Boost).",
    "Manfaat Meninggal hingga 150% total premi dibayar — dibayar lump sum.",
    "Rider: Payor Benefit Plus, Waiver of Premium Plus, Term Life.",
  ],
  strengths: [
    "Akseptasi dijamin — nasabah dengan riwayat kesehatan tetap diterima, tanpa cek medis.",
    "Tersedia IDR & USD untuk lindung nilai — PRUSmart Plan & Smart Wealth hanya IDR.",
    "Manfaat Meninggal lebih besar & dibayar lump sum, bukan dicicil seperti PRUSmart Plan.",
    "Frekuensi bayar terlengkap: tahunan / semesteran / kuartalan / bulanan.",
    "Rider terlengkap (Payor, Waiver, Term Life) — RetirePlan hanya Payor, Smart Wealth tanpa rider.",
    "Manfaat dijamin & unggul vs AIA RetirePlan di hampir semua skenario ilustrasi.",
  ],
  weaknesses: [
    "Pada skenario manfaat dijamin tertentu, Manfaat Tunai Tahunan PRUSmart Plan bisa lebih tinggi.",
    "Total manfaat AIA RetirePlan (dijamin + tidak dijamin) bisa 4–5% lebih tinggi di sebagian skenario.",
    "Entry premi tinggi (min. Rp25–50 jt/th) — bukan untuk segmen mass market.",
    "Masa Pertanggungan tetap 20 tahun (RetirePlan fleksibel 20/30/40/50 tahun).",
  ],
  competitors: [
    {
      provider: "AIA",
      productName: "Proteksi Retirement Maksima (RetirePlan)",
      headToHead:
        "Sama-sama dwiguna bancassurance BCA dengan Manfaat Tunai Tahunan — pesaing paling langsung.",
      strengths: [
        "Masa Pertanggungan fleksibel: 20 / 30 / 40 / 50 tahun.",
        "Total manfaat (dijamin + tidak dijamin) bisa 4–5% lebih tinggi di sebagian skenario.",
        "Tersedia IDR & USD.",
      ],
      weaknessesVsBca: [
        "Sebagian manfaat tidak dijamin (bergantung kinerja) — manfaat VALUE+ dijamin.",
        "VALUE+ lebih unggul di skenario manfaat dijamin pada hampir semua ilustrasi.",
        "Rider lebih terbatas — hanya Payor Benefit.",
      ],
    },
    {
      provider: "Prudential",
      productName: "PRUSmart Plan",
      headToHead:
        "Endowment dengan Manfaat Tunai Tahunan; sering jadi pembanding utama nasabah.",
      strengths: [
        "Manfaat Tunai Tahunan bisa lebih tinggi di skenario manfaat dijamin tertentu.",
        "Masa Pembayaran Premi lebih pendek (6 / 8 tahun).",
      ],
      weaknessesVsBca: [
        "Hanya IDR — tidak ada opsi USD.",
        "Manfaat Meninggal lebih kecil & dicicil (bukan lump sum) — VALUE+ lump sum & lebih besar.",
        "Channel agency, bukan bancassurance BCA.",
        "VALUE+ unggul bila Tertanggung hidup hingga akhir Masa Pertanggungan.",
      ],
    },
    {
      provider: "MSIG Life",
      productName: "Asuransi Jiwa Smart Wealth Assurance",
      headToHead:
        "Endowment bancassurance (KB Bukopin) dengan Manfaat Tahapan & manfaat tahunan.",
      strengths: [
        "Minimum premi lebih rendah (Rp12 jt/th).",
        "Ada Manfaat Meninggal Akibat Kecelakaan (+110% premi, maks. Rp2 M).",
        "Premi dibebaskan bila Tertanggung meninggal saat Masa Pembayaran Premi.",
      ],
      weaknessesVsBca: [
        "Full Underwriting — wajib cek kesehatan; VALUE+ Guaranteed Acceptance.",
        "Hanya IDR — tidak ada USD.",
        "Tanpa rider tambahan; VALUE+ ada Payor, Waiver, dan Term Life.",
        "Distribusi via KB Bukopin, bukan jaringan BCA.",
      ],
    },
  ],
  script: {
    opening:
      "Selamat siang Bapak/Ibu, terima kasih atas waktunya. Sebelum saya jelaskan produknya, boleh saya pastikan dulu — yang Bapak/Ibu cari itu instrumen yang bisa menumbuhkan dana untuk masa depan keluarga sekaligus tetap memberi proteksi, betul? Kebetulan ada satu produk BCA Life yang dirancang persis untuk kebutuhan itu, namanya VALUE+.",
    discoveryQuestions: [
      "Untuk dana masa depan ini, target Bapak/Ibu lebih ke arus kas tahunan (misal biaya rutin / pendidikan) atau dana besar sekaligus di akhir nanti?",
      "Bapak/Ibu lebih nyaman menyetor premi selama 5 tahun atau 10 tahun?",
      "Ada preferensi mata uang — Rupiah, atau USD untuk lindung nilai?",
      "Apakah ada kondisi kesehatan tertentu yang biasanya bikin pengajuan asuransi ribet? Karena VALUE+ akseptasinya dijamin tanpa cek kesehatan.",
    ],
    pitch:
      "VALUE+ adalah asuransi jiwa dwiguna 20 tahun: Bapak/Ibu cukup membayar premi 5 atau 10 tahun, lalu menikmati manfaatnya. Di akhir Masa Pertanggungan, manfaatnya bisa mencapai hingga 1.790% dari premi dasar disetahunkan. Kalau pilih Plan Boost, ada Manfaat Tunai Tahunan sampai 25% per tahun setelah masa bayar selesai — semacam 'gaji tahunan'. Bila terjadi risiko meninggal, ahli waris menerima santunan hingga 150% total premi secara langsung (lump sum), bukan dicicil. Semua ini tanpa pemeriksaan kesehatan, dan bisa dalam Rupiah maupun USD.",
    competitiveAdvantages: [
      "Akseptasi dijamin tanpa cek kesehatan — beda dengan MSIG Smart Wealth yang full underwriting.",
      "Pilihan Rupiah & USD — PRUSmart Plan dan Smart Wealth hanya Rupiah.",
      "Manfaat Meninggal lebih besar & dibayar lump sum — PRUSmart Plan lebih kecil dan dicicil.",
      "Manfaat dijamin, bukan bergantung kinerja investasi seperti sebagian manfaat AIA RetirePlan.",
      "Rider terlengkap: Payor Benefit Plus, Waiver of Premium Plus, dan Term Life.",
    ],
    objectionHandling: [
      {
        objection: "Preminya besar ya, minimal Rp25 juta setahun.",
        response:
          "Betul Pak/Bu, VALUE+ memang dirancang sebagai instrumen penempatan dana, bukan asuransi receh bulanan. Tapi ini bukan biaya yang hilang — di akhir 20 tahun manfaatnya bisa berlipat sampai 1.790% premi dasar, plus proteksi jiwa selama 20 tahun. Dibanding menaruh dana di deposito, di sini Bapak/Ibu dapat dua hal sekaligus: pertumbuhan dana yang dijamin dan proteksi.",
      },
      {
        objection: "Saya bandingkan dengan PRUSmart Plan dulu ya.",
        response:
          "Boleh sekali Pak/Bu, justru bagus dibandingkan. Dua pembedanya: pertama, kalau terjadi risiko, Manfaat Meninggal VALUE+ lebih besar dan dibayar langsung lump sum, sementara PRUSmart Plan lebih kecil dan dicicil tahunan. Kedua, VALUE+ ada opsi USD, PRUSmart hanya Rupiah. Untuk perlindungan keluarga dan lindung nilai mata uang, VALUE+ lebih unggul.",
      },
      {
        objection: "Saya khawatir tidak lolos karena ada riwayat sakit.",
        response:
          "Justru di situ keunggulan VALUE+, Pak/Bu. Produk ini Guaranteed Acceptance — akseptasi dijamin tanpa pemeriksaan kesehatan, jadi riwayat kesehatan tidak menghalangi penerimaan. (Catatan: ada batasan khusus bila sebelumnya pernah ditolak dan pernah klaim TPD/Penyakit Kritis di BCA Life.)",
      },
    ],
    closing:
      "Kalau menurut Bapak/Ibu manfaatnya sudah pas, saya bisa langsung bantu siapkan ilustrasi sesuai mata uang dan masa bayar yang dipilih — 5 atau 10 tahun. Kita mulai dari ilustrasi Rupiah Plan Boost dulu supaya kelihatan arus kas tahunannya, setuju Pak/Bu?",
  },
  prototype: true,
};

// ---------------------------------------------------------------------------
// Heritage+ — comparison built; sales script in progress
// ---------------------------------------------------------------------------

const HERITAGE_PLUS: ProductComparison = {
  id: "heritage-plus",
  name: "Heritage Platinum Protection (Heritage+)",
  shortName: "Heritage+",
  type: "Asuransi Jiwa Tradisional Seumur Hidup Kombinasi · IDR & USD",
  positioning:
    "Warisan & proteksi seumur hidup (hingga usia 99) dengan Uang Pertanggungan yang bertumbuh.",
  features: [
    "Pertanggungan hingga usia 99 tahun; UP min. Rp500 jt / US$35.000.",
    "Plan Essential (tanpa Manfaat Hidup) atau Secure (dengan Manfaat Hidup).",
    "MPP: Sekaligus / 2 / 5 / 10 / 15 tahun; premi min. Rp4,5 jt/th.",
    "UP naik tiap 5 tahun hingga maks. 200% UP.",
    "Tambahan Meninggal Kecelakaan +100% UP; Terminal Illness 20% UP.",
    "Manfaat Pemeriksaan Kesehatan 10% premi (maks. Rp2 jt).",
  ],
  strengths: [
    "Entry rendah (premi Rp4,5 jt, UP Rp500 jt) — kompetitor umumnya HNWI murni.",
    "Manfaat lebih lengkap: Meninggal Kecelakaan, Terminal Illness & Pemeriksaan Kesehatan yang kompetitor tradisional tak punya.",
    "Tersedia IDR & USD — banyak kompetitor IDR saja.",
    "Fleksibilitas MPP & usia masuk sejak 6 bulan.",
    "Manfaat Hidup lebih awal & besar (50% ROP di usia 60 / Tahun Polis ke-15).",
    "Premi lebih murah pada ilustrasi setara; UP naik 25% per 5 tahun.",
  ],
  weaknesses: [
    "Cap kenaikan UP hanya 200% (PRUInfinity 250%, AIA WPP s/d 300%).",
    "Manfaat Akhir Pertanggungan dikurangi Manfaat Hidup/TI — nominal bisa kalah.",
    "Premi lebih mahal dari produk berfitur ringkas (Sun Proteksi 100, MDLA).",
    "Pembebasan Premi (CI) berupa rider, bukan manfaat dasar.",
  ],
  competitors: [
    {
      provider: "Prudential",
      productName: "PRUInfinity",
      headToHead:
        "Whole life kombinasi premium dengan kenaikan UP — pembanding langsung Heritage+.",
      strengths: [
        "Cap kenaikan UP lebih tinggi: hingga 250%.",
      ],
      weaknessesVsBca: [
        "Hanya IDR — tak ada opsi USD.",
        "Tidak ada Tambahan Meninggal Kecelakaan, Terminal Illness, maupun Manfaat Pemeriksaan Kesehatan.",
        "Premi lebih mahal pada ilustrasi setara; Manfaat Hidup lebih lambat.",
      ],
    },
    {
      provider: "AIA",
      productName: "Wealth Premier Pro (WPP)",
      headToHead:
        "Whole life warisan high-end dengan kenaikan UP agresif.",
      strengths: [
        "Cap kenaikan UP tertinggi: hingga 300%.",
      ],
      weaknessesVsBca: [
        "Hanya IDR — tak ada opsi USD.",
        "Tanpa tiga manfaat tambahan Heritage+ (Kecelakaan / Terminal Illness / Pemeriksaan Kesehatan).",
        "Premi lebih mahal; Manfaat Hidup lebih lambat & lebih kecil.",
      ],
    },
    {
      provider: "Manulife",
      productName: "PRIME / MDLA",
      headToHead:
        "Whole life kombinasi dengan premi kompetitif sebagai alternatif murah.",
      strengths: [
        "MDLA premi hanya +18% pada ilustrasi setara — relatif terjangkau.",
      ],
      weaknessesVsBca: [
        "Hanya IDR — tak ada opsi USD.",
        "Tanpa Tambahan Meninggal Kecelakaan, Terminal Illness, & Manfaat Pemeriksaan Kesehatan.",
        "Usia masuk & pilihan MPP kurang fleksibel dibanding Heritage+.",
      ],
    },
  ],
  script: null,
};

// ---------------------------------------------------------------------------
// STAR — comparison built; sales script in progress
// ---------------------------------------------------------------------------

const STAR: ProductComparison = {
  id: "star",
  name: "Safety Guard Critical Cover (STAR)",
  shortName: "STAR",
  type: "Asuransi Kesehatan — Penyakit Kritis · IDR",
  positioning:
    "Proteksi penyakit kritis (minor & major) dengan pengembalian premi via No Claim Bonus.",
  features: [
    "UP Rp500 jt – Rp2 M; premi mulai Rp475.500/bulan.",
    "Pertanggungan tahunan, perpanjang otomatis hingga usia 84.",
    "Cakupan 58 Minor CI + 77 Major CI.",
    "Minor CI 25% UP (berlaku 2x); Major CI 100% UP.",
    "Tindakan Angioplasti 25% UP & Perawatan ICU 50% UP.",
    "No Claim Bonus 100% premi per periode 10 tahunan.",
  ],
  strengths: [
    "Cakupan kondisi lebih luas: 58 Minor + 77 Major CI.",
    "Minor CI berlaku 2x (diagnosis berbeda) — kompetitor umumnya 1x.",
    "Angioplasti accelerated 25% UP — lebih besar dari PPKA/ASLI.",
    "Manfaat Perawatan ICU 50% UP — Allianz, Zurich & ASLI tak punya.",
    "No Claim Bonus 100% ROP per 10 tahun — cair lebih awal dari manfaat akhir kompetitor.",
    "Premi murah di usia muda (YRT), untung bila klaim di tahun-tahun awal.",
  ],
  weaknesses: [
    "YRT: akumulasi premi lebih mahal bila dipegang lama (Allianz ±2x, PPKA +73%, ASLI ±30%).",
    "Polis berakhir setelah klaim Major CI (Zurich tetap lanjut + masih bisa Manfaat Meninggal).",
    "Manfaat Meninggal dikurangi semua manfaat yang sudah dibayar.",
    "No Claim Bonus hangus bila ada klaim apapun.",
  ],
  competitors: [
    {
      provider: "Allianz",
      productName: "Critical Plus / CriticalCare",
      headToHead:
        "Asuransi penyakit kritis mainstream dengan Booster UP — pembanding paling sering.",
      strengths: [
        "Booster UP / Advanced CI bernominal lebih besar.",
        "Akumulasi premi lebih stabil bila polis dipegang sangat lama.",
      ],
      weaknessesVsBca: [
        "Minor CI lebih sedikit (30 kondisi) dan umumnya berlaku 1x.",
        "Tidak ada Manfaat Perawatan ICU.",
        "Manfaat akhir kontrak cair lebih lambat dibanding NCB 10 tahunan STAR.",
      ],
    },
    {
      provider: "Manulife",
      productName: "Proteksi Prima Kritis Andalan (PPKA)",
      headToHead:
        "Penyakit kritis dengan Booster UP besar; pesaing untuk nasabah jangka panjang.",
      strengths: [
        "Booster UP / Advanced CI bernominal lebih besar.",
        "Akumulasi premi +73% lebih murah dari STAR bila dipegang lama.",
      ],
      weaknessesVsBca: [
        "Perawatan ICU hanya 25% UP (STAR 50% UP).",
        "Angioplasti non-accelerated dan/atau nominal lebih kecil.",
        "Minor CI lebih sedikit dibanding 58 kondisi STAR.",
      ],
    },
    {
      provider: "Astra Life",
      productName: "ASLI Critical Care Protector",
      headToHead:
        "Penyakit kritis dengan manfaat akhir kontrak yang tetap cair meski sempat klaim minor.",
      strengths: [
        "Manfaat Akhir Kontrak tetap cair meski sempat klaim minor (NCB STAR hangus bila klaim).",
        "Manfaat Meninggal hanya dikurangi Minor CI.",
      ],
      weaknessesVsBca: [
        "Minor CI lebih sedikit (38 kondisi) dibanding 58 STAR.",
        "Tidak ada Manfaat Perawatan ICU.",
        "Tindakan Angioplasti bernominal lebih kecil.",
      ],
    },
  ],
  script: null,
};

export const PRODUCTS: ProductComparison[] = [VALUE_PLUS, HERITAGE_PLUS, STAR];
