// After `cap sync`: replace the PWA service worker in the Android web assets with a self-destructing one.
// Inside Capacitor the assets are already local, so a worker only risks serving a stale bundle after an
// update (which happened). An old worker that checks for updates finds this file, installs it, and the new
// worker deletes every cache, unregisters itself and reloads the page from the real assets.
import { rmSync, writeFileSync, globSync } from "node:fs";

const dir = "android/app/src/main/assets/public";
for (const f of globSync("workbox-*.js", { cwd: dir })) {
  rmSync(`${dir}/${f}`, { force: true });
  console.log(`removed ${dir}/${f}`);
}
writeFileSync(
  `${dir}/sw.js`,
  `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) await caches.delete(k);
      await self.registration.unregister();
      for (const c of await self.clients.matchAll({ type: "window" })) c.navigate(c.url);
    })(),
  ),
);
`,
);
console.log(`wrote self-destructing ${dir}/sw.js`);
