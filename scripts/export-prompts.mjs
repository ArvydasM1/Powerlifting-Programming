/** Writes analysis/prompts.json from src/analysis/prompt.ts so analysis/run.mjs uses the same prompt as the app. */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true }, logLevel: "error" });
const mod = await server.ssrLoadModule("/src/analysis/prompt.ts");
writeFileSync(resolve("analysis", "prompts.json"), JSON.stringify({ system: mod.SYSTEM_PROMPT, user: mod.USER_PROMPTS }, null, 1));
await server.close();
console.log("analysis/prompts.json written");
