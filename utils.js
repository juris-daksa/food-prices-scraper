import puppeteer from 'puppeteer-core';

export async function resetSession(brdConfig, url) {
    const browser = await puppeteer.connect({
        browserWSEndpoint: brdConfig,
        ignoreHTTPSErrors: true,
        headless: true,
    });

    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'media', 'font'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    return { browser, page };
}
