import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#0b0f17",
        panel: "#111827",
        line: "#1f2937",
        text: "#e5e7eb",
        muted: "#9ca3af",
        accent: "#f59e0b",
        accent2: "#22d3ee",
        good: "#10b981",
        bad: "#ef4444"
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"]
      }
    }
  },
  plugins: []
};
export default config;
