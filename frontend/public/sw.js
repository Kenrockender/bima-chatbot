// Bump CACHE on every deploy that changes caching behaviour. The activate
// handler purges any cache whose name doesn't match, so an updated value
// evicts stale assets. skipWaiting + clients.claim make the new worker take
// over immediately; the page-side registration reloads once on
// controllerchange so users always land on the freshly deployed build.
const CACHE = "bima-v2";

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
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;

  if (request.method !== "GET") return;
  if (request.url.includes("/api/")) return;

  // Hashed Next.js build assets are immutable, so cache-first is safe and fast;
  // a new build produces new filenames that simply miss the cache and fetch.
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

  // Navigations are network-first so fresh HTML (and its new asset refs) always
  // wins; the precached shell is only a last-resort offline fallback.
  if (request.mode === "navigate") {
    e.respondWith(fetch(request).catch(() => caches.match("/")));
  }
});
