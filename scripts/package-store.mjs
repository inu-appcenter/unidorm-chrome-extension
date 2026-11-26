import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const distDir = resolve(root, "dist");
const releaseDir = resolve(root, "release");
mkdirSync(releaseDir, { recursive: true });

const manifest = JSON.parse(
  readFileSync(resolve(distDir, "manifest.json"), "utf-8"),
);
const version = manifest.version || "1.0.0";
const zipPath = resolve(releaseDir, `unidorm-chrome-extension-v${version}.zip`);

if (existsSync(zipPath)) {
  rmSync(zipPath);
}

if (process.platform === "win32") {
  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path "${distDir}\\*" -DestinationPath "${zipPath}" -Force`,
    ],
    { stdio: "inherit" },
  );
} else {
  execFileSync("zip", ["-r", zipPath, "."], {
    cwd: distDir,
    stdio: "inherit",
  });
}

console.log(`[unidorm-chrome-extension] Store package created: ${zipPath}`);
