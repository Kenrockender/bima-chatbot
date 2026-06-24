import "./globals.css";
import Script from "next/script";
import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import { AuthGate } from "@/components/AuthGate";

export const viewport: Viewport = {
  themeColor: "#061330",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "BIMA — BCA Life Intelligent Mobile Assistant",
  description:
    "Senantiasa Melindungi Anda. BIMA adalah asisten onboarding cerdas BCA Life — selalu siap menemani langkahmu memahami produk, kebijakan, dan proses kami.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BIMA",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/api/pwa-icon?size=180",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="font-sans antialiased text-bca-ink">
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
        <Script id="sw-register" strategy="afterInteractive">
          {`if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js")`}
        </Script>
      </body>
    </html>
  );
}
