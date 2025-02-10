import puppeteer from 'puppeteer-core';

export async function resetSession(brdConfig, url) {
    const browser = await puppeteer.connect({
        browserWSEndpoint: brdConfig, // The WebSocket endpoint for connecting to the remote browser
        ignoreHTTPSErrors: true,
        headless: true,
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    return { browser, page };
}
