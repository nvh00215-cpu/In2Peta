import type { Config } from "tailwindcss";

/**
 * In2Peta design tokens — encoded 1:1 from design-system.json.
 * Every color, radius, font size and shadow used in the app MUST come from here.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // colorPalette.primary
        terracotta: "#B8754A",
        "terracotta-dark": "#A6633A",
        // colorPalette.neutrals
        "near-black": "#141414",
        charcoal: "#1E1E1E",
        "off-white": "#F7F5F3",
        "light-gray": "#EDEBE8",
        "mid-gray": "#8A8A8A",
        "border-gray": "#E2DFDC",
        // colorPalette.accent — promo/urgency badges ONLY
        promo: "#D9483C",
        // colorPalette.textOnLight (suffixed to avoid utility collisions with the type scale)
        heading: "#1A1A1A",
        "body-gray": "#6B6B6B",
        "muted-gray": "#9C9C9C",

        // shadcn semantic aliases (mapped onto the palette, light theme only)
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "Poppins", "system-ui", "sans-serif"],
      },
      // typography.scale — the ONLY allowed sizes
      fontSize: {
        display: [
          "34px",
          { lineHeight: "1.15", letterSpacing: "-0.5px", fontWeight: "700" },
        ],
        section: ["20px", { lineHeight: "1.2", fontWeight: "600" }],
        "card-title": ["15px", { lineHeight: "1.35", fontWeight: "600" }],
        body: ["14px", { lineHeight: "1.55", fontWeight: "400" }],
        caption: ["12px", { lineHeight: "1.4", fontWeight: "400" }],
        price: ["15px", { lineHeight: "1.3", fontWeight: "700" }],
        btn: ["15px", { lineHeight: "1", letterSpacing: "0.2px", fontWeight: "600" }],
      },
      // layoutAndStructure.cornerRadius
      borderRadius: {
        "card-lg": "24px",
        "card-sm": "16px",
        banner: "20px",
        btn: "28px",
        pill: "999px",
        icon: "12px",
        // shadcn aliases used by ui/ primitives
        lg: "16px",
        md: "12px",
        sm: "8px",
      },
      // layoutAndStructure.spacingScale — prefer these utilities only
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
      },
      boxShadow: {
        // elevation: soft, low-opacity, on white cards over light backgrounds only
        card: "0 6px 20px rgba(20, 20, 20, 0.06)",
        "card-hover": "0 10px 28px rgba(20, 20, 20, 0.10)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
