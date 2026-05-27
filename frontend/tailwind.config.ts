import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bca: {
          // Core BCA Life palette
          navy: "#003D7A",       // primary corporate blue
          navyDeep: "#002854",   // darker for gradients / hover
          blue: "#003D7A",       // alias
          azure: "#0066B3",      // BCA mid blue
          sky: "#E8F1FB",        // soft tinted background
          skyDeep: "#CFE0F4",    // tinted border / chip
          yellow: "#FFD200",     // BCA Life signature yellow accent
          yellowSoft: "#FFE680", // hover / glow
          yellowDeep: "#E5B800", // pressed
          // Warm editorial palette (current design)
          gold: "#C8941E",       // warm gold accent
          goldLight: "#E6B85A",  // gold hover / gradient end
          cream: "#FDFBF6",      // warm off-white background
          creamDeep: "#F4ECDA",  // warm card gradient end
          rule: "#E6DFD0",       // warm border color
          // Neutrals
          ink: "#0F2238",
          slate: "#374A63",
          mute: "#6B7B8F",
          line: "#E4ECF5",
          paper: "#FFFFFF",
          bg: "#F6F9FD",
          // Legacy aliases
          accent: "#0066B3",
          ink2: "#0F2238",
          // ── BIMA dark shell ──
          shellDeep: "#061330",      // outermost canvas
          shellMid: "#0B2451",       // window background
          shellEdge: "#F5C518",      // yellow side-glow
          panel: "rgba(11,36,81,0.78)",
          panelStroke: "rgba(245,197,24,0.18)",
          chatLight: "#E9E5DA",      // chat panel light background
          chatLightTo: "#C8C2B4",
          bimaBubble: "#F1EBDF",
          userBubble: "#1B3A6B",
          accentGold: "#F5C518",
          accentGoldDeep: "#E5B100",
          accentGoldSoft: "#FFE07A",
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ['"Playfair Display"', "ui-serif", "Georgia", "Cambria", "serif"],
        display: ['"Plus Jakarta Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        smallcaps: "0.14em",
      },
      borderRadius: {
        bca: "18px",
        bcaSm: "12px",
        bcaLg: "24px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,34,56,0.04), 0 8px 24px -10px rgba(0,61,122,0.14)",
        cardHover: "0 2px 4px rgba(15,34,56,0.06), 0 16px 36px -12px rgba(0,61,122,0.22)",
        soft: "0 1px 2px rgba(15,34,56,0.06)",
        paper: "0 1px 2px rgba(15,34,56,0.04), 0 4px 16px -6px rgba(0,61,122,0.08)",
        ring: "0 0 0 4px rgba(200,148,30,0.25)",
        ringBlue: "0 0 0 4px rgba(0,102,179,0.18)",
        float: "0 8px 24px -6px rgba(0,61,122,0.35)",
      },
      keyframes: {
        riseIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        blink: {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "1" },
        },
        bounceDot: {
          "0%, 80%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "40%": { transform: "translateY(-4px)", opacity: "1" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.6" },
          "70%": { transform: "scale(1.4)", opacity: "0" },
          "100%": { transform: "scale(1.4)", opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        riseIn: "riseIn 500ms cubic-bezier(0.16, 1, 0.3, 1) both",
        fadeIn: "fadeIn 500ms ease-out both",
        blink: "blink 1.4s ease-in-out infinite",
        bounceDot: "bounceDot 1.2s ease-in-out infinite",
        pulseRing: "pulseRing 1.8s ease-out infinite",
        shimmer: "shimmer 4s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
