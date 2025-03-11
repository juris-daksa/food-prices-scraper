import puppeteer from "puppeteer-core";
import { executablePath } from "puppeteer";

export async function resetSession(brdConfig, url) {
  let browser;

  if (brdConfig) {
    console.log("Using Bright Data WebSocket connection...");
    browser = await puppeteer.connect({
      browserWSEndpoint: brdConfig,
      ignoreHTTPSErrors: true,
      headless: true,
    });
  } else {
    browser = await puppeteer.launch({
      executablePath: executablePath(),
      headless: "new",
      ignoreHTTPSErrors: true,
    });
  }

  const page = await browser.newPage();

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (["image", "media", "font"].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });

  return { browser, page };
}