// 検証用 Brave を専用プロファイル + リモートデバッグ付きで起動する（QA 専用。拡張機能の動作自体には不要）
// 使い方: bun qa/launch-brave.mjs [url...]
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PORT } from "./lib.mjs";

const BRAVE = process.env.BRAVE_PATH ?? "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const profile = process.env.QA_PROFILE ?? `${process.env.LOCALAPPDATA}\\gdocs-menu-customizer-qa\\profile`;
const ext = fileURLToPath(new URL("../extension", import.meta.url));

mkdirSync(profile, { recursive: true });
const urls = process.argv.slice(2);
const child = spawn(
  BRAVE,
  [
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${PORT}`,
    `--load-extension=${ext}`,
    `--disable-extensions-except=${ext}`,
    "--disable-features=DisableLoadExtensionCommandLineSwitch",
    "--no-first-run",
    "--no-default-browser-check",
    "--lang=ja",
    "--window-size=1440,900",
    ...(urls.length ? urls : ["about:blank"]),
  ],
  { detached: true, stdio: "ignore" },
);
child.unref();
console.log(`Brave started (pid ${child.pid}) port=${PORT} profile=${profile}`);
