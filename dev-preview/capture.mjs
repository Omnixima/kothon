// Retina (2x) screenshots of every Kothon screen, light and dark, from the
// browser preview. Start `bunx vite dev --port 1420` first, then:
//   node dev-preview/capture.mjs OUT_DIR
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "screenshots";
mkdirSync(out, { recursive: true });
const BASE = "http://localhost:1420/dev-preview/index.html";
// Kothon's window is 720x600; a little wider shows the layout at its best.
const VIEW = { width: 880, height: 620 };

// The installed Google Chrome, so no Playwright browser download is needed.
const browser = await chromium.launch({ channel: "chrome" });

async function shoot(scheme, name, setup) {
  const ctx = await browser.newContext({
    viewport: VIEW,
    deviceScaleFactor: 2,
    colorScheme: scheme,
  });
  const page = await ctx.newPage();
  await setup(page);
  // Match the released 0.1.0, which has no beta badge yet (?beta=1 keeps it).
  if (!process.env.BETA)
    await page.addStyleTag({ content: "[data-beta]{display:none!important}" });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}-${scheme}.png` });
  await ctx.close();
  console.log("saved", `${name}-${scheme}.png`);
}

const open =
  (query = "") =>
  async (page) => {
    await page.goto(BASE + query);
    await page.waitForTimeout(1500);
  };
const tab = (label, sub) => async (page) => {
  await open()(page);
  await page.getByRole("button", { name: label, exact: true }).first().click();
  if (sub) {
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: sub, exact: true }).first().click();
  }
};
const onboarding = (step) => async (page) => {
  await page.goto(BASE + "?onboarding=1");
  await page.evaluate((s) => {
    localStorage.setItem(
      "kothon.onboarding",
      JSON.stringify({
        step: s,
        languages: ["bn"],
        downloadId: "kothon-bn-fastconformer-116m",
      }),
    );
  }, step);
  await page.goto(BASE + "?onboarding=1");
  await page.waitForTimeout(1500);
};

for (const scheme of ["light", "dark"]) {
  await shoot(scheme, "01-home", open());
  await shoot(scheme, "02-history", tab("History"));
  await shoot(scheme, "03-models", tab("Models"));
  await shoot(scheme, "04-settings-general", tab("Settings"));
  await shoot(scheme, "05-settings-advanced", tab("Settings", "Advanced"));
  await shoot(scheme, "06-about", tab("Settings", "About"));
  await shoot(scheme, "07-onboarding-language", onboarding("welcome"));
  await shoot(scheme, "08-onboarding-model", onboarding("model"));
  await shoot(scheme, "09-onboarding-access", onboarding("permissions"));
  await shoot(scheme, "10-onboarding-first-words", onboarding("try"));
}
await browser.close();
