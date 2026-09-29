// Remove the PWA service worker from the Android web assets after `cap sync`.
// Inside Capacitor the assets are already local; a worker only risks serving a stale bundle.
// A missing sw.js also makes the WebView drop any worker an earlier build registered (404 on update check).
import { rmSync } from "node:fs";
import { globSync } from "node:fs";

const dir = "android/app/src/main/assets/public";
for (const f of ["sw.js", ...globSync("workbox-*.js", { cwd: dir })]) {
  rmSync(`${dir}/${f}`, { force: true });
  console.log(`removed ${dir}/${f}`);
}
