import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import { AuthGate } from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "BIMA — BCA Life Intelligent Mobile Assistant",
  description:
    "Senantiasa Melindungi Anda. BIMA adalah asisten onboarding cerdas BCA Life — selalu siap menemani langkahmu memahami produk, kebijakan, dan proses kami.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-sans antialiased text-bca-ink">
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
