import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getRandomProxy } from './proxy.js';

export function getDirname(importMetaUrl) {
    const __filename = fileURLToPath(importMetaUrl);
    return dirname(__filename);
}

export async function resetSession() {
    const proxy = await getRandomProxy();
    const browser = await puppeteer.launch({
        args: [`--proxy-server=${proxy}`],
        ignoreHTTPSErrors: true,
        headless: true,
    });

    const page = await browser.newPage();
    return { browser, page };
}
