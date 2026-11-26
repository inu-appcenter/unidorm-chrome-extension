import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("unidorm-extension manifest", () => {
  it("declares valid Manifest V3 permissions and INU host_permissions", () => {
    const manifestPath = resolve(process.cwd(), "public/manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual(
      expect.arrayContaining([
        "tabs",
        "scripting",
        "storage",
        "cookies",
        "webNavigation",
      ]),
    );
    expect(manifest.host_permissions).toEqual(
      expect.arrayContaining([
        "https://portal.inu.ac.kr/*",
        "http://erp.inu.ac.kr/*",
        "https://erp.inu.ac.kr/*",
      ]),
    );
    expect(manifest.background?.service_worker).toBe("background.js");
  });

  it("bundles @inu-appcenter/unidorm-portal-helper without bare module specifiers in dist outputs", () => {
    for (const file of ["dist/background.js", "dist/content.js", "dist/popup.js"]) {
      const content = readFileSync(resolve(process.cwd(), file), "utf-8");
      expect(content).not.toContain('"@inu-appcenter/unidorm-portal-helper"');
      expect(content).not.toContain("'@inu-appcenter/unidorm-portal-helper'");
    }
  });
});
