import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const allowedHostsEnv = process.env.ALLOWED_HOSTS;
// Explicitly type serverOption so TypeScript doesn't widen the boolean literal to `boolean`.
let serverOption: { allowedHosts: true | string[] } | undefined;
if (allowedHostsEnv) {
  const parts = allowedHostsEnv.split(",").map((s) => s.trim()).filter(Boolean);
  // Vite's `allowedHosts` typing expects `true | string[] | undefined`.
  // - `true` means allow any host (used for wildcard)
  // - `string[]` is an explicit list of hosts
  // Map user input accordingly:
  if (parts.length === 1 && (parts[0] === "*" || parts[0].toLowerCase() === "all")) {
    // Assign the literal `true` which matches the typed union.
    serverOption = { allowedHosts: true };
  } else {
    serverOption = { allowedHosts: parts };
  }
}

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
  server: serverOption ?? undefined,
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
