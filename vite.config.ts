import { defineConfig } from "vite";

// Relative base so the build works at any GitHub Pages path (e.g. /Home/).
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    rollupOptions: {
      input: { main: "index.html", book: "book.html" },
    },
  },
});
