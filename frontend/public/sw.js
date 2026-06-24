const CACHE = "bima-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;

  if (request.method !== "GET") return;
  if (request.url.includes("/api/")) return;

  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image"
  ) {
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((resp) => {
            if (resp.ok) {
              const clone = resp.clone();
              caches.open(CACHE).then((c) => c.put(request, clone));
            }
            return resp;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    e.respondWith(fetch(request).catch(() => caches.match("/")));
  }
});
