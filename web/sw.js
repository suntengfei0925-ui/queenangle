const OFFLINE_HTML = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>QueenAngle</title>
    <style>
      :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { display: grid; min-height: 100vh; margin: 0; place-items: center; background: #f6f7f9; color: #111827; }
      main { width: min(100% - 36px, 420px); text-align: center; }
      strong { display: grid; width: 56px; height: 56px; margin: 0 auto 18px; place-items: center; border-radius: 8px; background: #111827; color: #fff; font-size: 18px; }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 0; color: #6b7280; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <strong>QA</strong>
      <h1>网络不可用</h1>
      <p>请连接网络后重试。</p>
    </main>
  </body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => new Response(OFFLINE_HTML, {
        status: 503,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }))
    );
    return;
  }

  event.respondWith(fetch(request, { cache: "no-store" }));
});
