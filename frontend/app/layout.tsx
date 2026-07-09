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
  title: "Sera — Asisten Cerdas BCA Life",
  description:
    "Senantiasa Melindungi Anda. Sera adalah asisten cerdas BCA Life — selalu siap menemani langkahmu memahami produk, kebijakan, dan proses kami.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Sera",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/sera-icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: "/sera-apple.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Apply the saved/system theme before first paint to avoid a flash.
            Mirrors the logic in components/ThemeToggle.tsx. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem("sera-theme");if(!t||t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";if(t==="dark")document.documentElement.classList.add("dark");}catch(e){}})()`}
        </Script>
      </head>
      <body className="font-sans antialiased text-bca-ink">
        <AuthProvider>
          <AuthGate>{children}</AuthGate>
        </AuthProvider>
        <Script id="sw-register" strategy="afterInteractive">
          {`if("serviceWorker"in navigator){var sw=navigator.serviceWorker;sw.register("/sw.js",{updateViaCache:"none"}).then(function(r){r.update()});var reloaded=false;sw.addEventListener("controllerchange",function(){if(reloaded)return;reloaded=true;location.reload()})}`}
        </Script>
      </body>
    </html>
  );
}
