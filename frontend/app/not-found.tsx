import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-life-page flex items-center justify-center px-6">
      <div className="life-card p-8 max-w-[440px] w-full text-center">
        <div className="font-sans font-extrabold text-life-blue text-[56px] leading-none mb-2">
          404
        </div>
        <h1 className="font-sans font-extrabold text-life-heading text-[20px] mb-2">
          Halaman tidak ditemukan
        </h1>
        <p className="text-[14px] text-life-body leading-relaxed mb-6">
          Halaman yang kamu cari tidak ada atau sudah dipindahkan.
        </p>
        <Link href="/" className="btn-life mx-auto">
          <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-life-amber" />
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
