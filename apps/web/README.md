# web

Frontend for Kang.

For container deployments, set `VITE_API_URL` to the public HTTPS origin of the
API service. `VITE_WS_URL` is optional and only needed if websocket traffic uses
a different public origin than HTTP. The production container writes those
values into `/runtime-config.js` at startup so they can be supplied as runtime
environment variables.
