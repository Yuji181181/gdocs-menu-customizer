// 展開済み拡張機能の ID を求める（Chromium はフォルダの絶対パスの SHA-256 から ID を作る）
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export function extensionId() {
  const path = fileURLToPath(new URL("../extension", import.meta.url));
  const bytes = process.platform === "win32" ? Buffer.from(path, "utf16le") : Buffer.from(path, "utf8");
  const hex = createHash("sha256").update(bytes).digest("hex").slice(0, 32);
  return [...hex].map((c) => String.fromCharCode("a".charCodeAt(0) + parseInt(c, 16))).join("");
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) console.log(extensionId());
