const port = Number(process.env.PORT ?? 4173);
const dist = new URL("dist/", import.meta.url).pathname;
const apiUrl = process.env.API_URL ?? "";

const configScript = `<script>window.KANG_API_URL = ${JSON.stringify(apiUrl)};</script>`;
const html = (await Bun.file(`${dist}index.html`).text()).replace(
  "</head>",
  `${configScript}</head>`,
);

Bun.serve({
  port,
  async fetch(req) {
    const { pathname } = new URL(req.url);

    if (pathname !== "/" && pathname !== "/index.html") {
      const file = Bun.file(`${dist}${pathname.slice(1)}`);
      if (await file.exists()) return new Response(file);
    }

    return new Response(html, { headers: { "Content-Type": "text/html" } });
  },
});

console.log(`Serving on http://localhost:${port}`);
