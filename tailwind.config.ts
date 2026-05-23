import type { Config } from "tailwindcss";

export default {
  content: ["./src/renderer/**/*.{html,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        console: {
          bg: "#080b0f",
          panel: "#10151d",
          line: "#27313f",
          muted: "#8b98a8",
          text: "#e6edf3",
          green: "#7ee787",
          amber: "#f2cc60",
          red: "#ff7b72"
        }
      },
      fontFamily: {
        mono: ["SFMono-Regular", "Consolas", "Liberation Mono", "Menlo", "monospace"]
      }
    }
  },
  plugins: []
} satisfies Config;
