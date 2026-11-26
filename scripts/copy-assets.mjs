import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const isProd = process.argv.includes("--prod");
const root = process.cwd();
const distDir = resolve(root, "dist");
mkdirSync(distDir, { recursive: true });

// manifest.json 처리 (프로덕션 스토어 빌드 시 localhost 개발 매칭 제거)
const rawManifest = JSON.parse(
  readFileSync(resolve(root, "public/manifest.json"), "utf-8"),
);

if (isProd && Array.isArray(rawManifest.content_scripts)) {
  rawManifest.content_scripts = rawManifest.content_scripts.map((cs) => ({
    ...cs,
    matches: (cs.matches || []).filter(
      (pattern) =>
        !pattern.startsWith("http://localhost:") &&
        !pattern.startsWith("http://127.0.0.1:"),
    ),
  }));

  // 프로덕션 번들에서는 sourcemap 파일 제거
  for (const mapFile of ["background.js.map", "content.js.map", "popup.js.map"]) {
    const mapPath = resolve(distDir, mapFile);
    if (existsSync(mapPath)) {
      rmSync(mapPath);
    }
  }
}

writeFileSync(
  resolve(distDir, "manifest.json"),
  JSON.stringify(rawManifest, null, 2) + "\n",
  "utf-8",
);
copyFileSync(resolve(root, "public/popup.html"), resolve(distDir, "popup.html"));

const iconsSrc = resolve(root, "public/icons");
if (existsSync(iconsSrc)) {
  cpSync(iconsSrc, resolve(distDir, "icons"), { recursive: true });
}

console.log(
  `[unidorm-chrome-extension] Copied assets to dist/ (mode: ${isProd ? "store-prod" : "dev"})`,
);
