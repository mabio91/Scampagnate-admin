import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const manualChunks = (id: string) => {
  if (!id.includes("/node_modules/")) return undefined;

  if (id.includes("/node_modules/lucide-react/dist/esm/icons/")) {
    const iconFile = id.split("/node_modules/lucide-react/dist/esm/icons/")[1] ?? "";
    const firstLetter = iconFile[0]?.toLowerCase() ?? "";
    if (firstLetter < "g") return "icons-a-f";
    if (firstLetter < "m") return "icons-g-l";
    if (firstLetter < "s") return "icons-m-r";
    return "icons-s-z";
  }

  if (id.includes("/node_modules/lucide-react/")) return "icons-core";

  const groups: Array<[string, string[]]> = [
    ["react-vendor", ["react/", "react-dom/", "scheduler/", "react-router/", "react-router-dom/", "@remix-run/router/", "next-themes/"]],
    ["query-vendor", ["@tanstack/"]],
    ["supabase-vendor", ["@supabase/"]],
    ["radix-vendor", ["@radix-ui/"]],
    ["form-vendor", ["react-hook-form/", "@hookform/", "zod/"]],
    ["editor-vendor", ["@tiptap/", "prosemirror-"]],
    ["date-vendor", ["date-fns/"]],
    ["ui-vendor", ["sonner/", "vaul/", "cmdk/", "input-otp/"]],
  ];

  for (const [chunkName, packages] of groups) {
    if (packages.some((packageName) => id.includes(`/node_modules/${packageName}`))) {
      return chunkName;
    }
  }

  return "vendor";
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
}));
