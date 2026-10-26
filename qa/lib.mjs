import { chromium } from "playwright-core";

export const PORT = Number(process.env.QA_PORT ?? 9333);
export const SHOTS = new URL("./screenshots/", import.meta.url);

export async function connect() {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const context = browser.contexts()[0];
  return { browser, context };
}

export function findPage(context, pattern) {
  return context.pages().find((p) => pattern.test(p.url()));
}

export async function shot(page, name, opts = {}) {
  const path = new URL(`${name}.png`, SHOTS);
  await page.screenshot({ path: decodeURIComponent(path.pathname.slice(1)), ...opts });
  return decodeURIComponent(path.pathname.slice(1));
}
