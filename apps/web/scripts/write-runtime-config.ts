const distDir = Bun.argv[2] ?? "dist";
const apiUrl = process.env.API_URL ?? process.env.VITE_API_URL ?? "";
const wsUrl = process.env.WS_URL ?? process.env.VITE_WS_URL ?? "";

const runtimeConfig = {
  API_URL: apiUrl,
  WS_URL: wsUrl,
};

await Bun.write(
  `${distDir}/runtime-config.js`,
  `window.__KANG_RUNTIME_CONFIG__ = ${JSON.stringify(runtimeConfig, null, 2)};\n`,
);

console.log(`Wrote runtime config to ${distDir}/runtime-config.js`);
