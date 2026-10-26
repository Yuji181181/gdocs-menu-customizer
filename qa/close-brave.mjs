// 検証用 Brave を閉じる
import { connect } from "./lib.mjs";

try {
  const { browser } = await connect();
  const cdp = await browser.newBrowserCDPSession();
  await cdp.send("Browser.close").catch(() => {});
  console.log("closed");
} catch (e) {
  console.log("not running:", e.message.split("\n")[0]);
}
process.exit(0);
