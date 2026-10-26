// 使い方: node qa/eval.mjs <urlRegex> <js expression | path/to/snippet.js> [screenshotName]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { connect, findPage, shot } from "./lib.mjs";

const [, , urlPattern = "docs\\.google\\.com", exprArg = "document.title", shotName] = process.argv;
const expr = exprArg.endsWith(".js") && existsSync(exprArg) ? readFileSync(exprArg, "utf8") : exprArg;
const { context } = await connect();
const page = findPage(context, new RegExp(urlPattern)) ?? context.pages()[0];
try {
  const result = await page.evaluate(expr);
  const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  if (process.env.QA_OUT) writeFileSync(process.env.QA_OUT, text, "utf8");
  else console.log(text);
  if (shotName) console.log("screenshot:", await shot(page, shotName));
  process.exit(0);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
