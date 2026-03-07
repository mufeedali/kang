import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const allowedHostsEnv = process.env.ALLOWED_HOSTS;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Allow configuring Vite dev server allowed hosts via ALLOWED_HOSTS environment variable.
  // - Set to a comma-separated list of hosts to allow (e.g. "example.com,sub.example.com")
  // - Use "*" or "all" to allow all hosts (maps to `allowedHosts: true`)
  server: {
    host: true, // Listen on all addresses when using --host flag
    allowedHosts: allowedHostsEnv
      ? allowedHostsEnv.split(",").map((s) => s.trim()).filter(Boolean)
      : ["localhost"],
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
});
