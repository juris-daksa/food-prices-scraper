import puppeteer from 'puppeteer-core';

export async function resetSession(brdConfig) {
    const browser = await puppeteer.connect({
        browserWSEndpoint: brdConfig, 
        ignoreHTTPSErrors: true,
        headless: true,
    });

    const page = await browser.newPage();
    return { browser, page };
}
