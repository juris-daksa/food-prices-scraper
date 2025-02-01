import fs from 'fs';
import { dirname, resolve, join } from 'path';
import dotenv from 'dotenv';
import inquirer from 'inquirer';
import { resetSession } from './utils.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

async function loadStoreConfigs() {
    const storesDir = resolve(__dirname, 'stores');
    const stores = fs.readdirSync(storesDir).filter(file => fs.lstatSync(join(storesDir, file)).isDirectory());

    const storeConfigs = {};
    for (const store of stores) {
        const configFilePath = join(storesDir, store, 'config.json');
        if (fs.existsSync(configFilePath)) {
            const config = JSON.parse(fs.readFileSync(configFilePath));
            storeConfigs[store] = config;
        }
    }
    return storeConfigs;
}

async function selectStore(storeConfigs) {
    const choices = Object.keys(storeConfigs).map(store => ({
        name: store.charAt(0).toUpperCase() + store.slice(1),
        value: store
    }));

    if (choices.length === 0) {
        throw new Error("No selectable choices available. Ensure your store configurations are properly loaded.");
    }

    const response = await inquirer.prompt([
        {
            type: 'list',
            message: 'Select the e-store to scrape',
            name: 'store',
            choices,
        }
    ]);

    return response.store;
}

export async function scrapeProducts() {
    let browser;
    let page;

    const brdConfig = process.env.BRD_CONFIG;

    try {
        const storeConfigs = await loadStoreConfigs();
        const store = await selectStore(storeConfigs);
        const config = storeConfigs[store];

        const selectedCategories = config.categories;
        let allProducts = {};

        for (const { href, category } of selectedCategories) {
            const absoluteLink = new URL(href, config.baseUrl).href;
            ({ browser, page } = await resetSession(brdConfig));
            await page.goto(absoluteLink, { waitUntil: "domcontentloaded", timeout: 60000 });

            const { extractProducts } = await import(`./stores/${store}/scraper.js`);
            const products = await extractProducts(page, category);

            allProducts[category] = products;
        }

        const dateTime = new Date();
        const output = {
            dateTime,
            categories: allProducts
        };

        const fileName = `${store}-products-${dateTime.toISOString().split('T')[0]}.json`;
        fs.writeFileSync(fileName, JSON.stringify(output, null, 2));

        return allProducts;
    } catch (error) {
        console.error('Export failed:', error);
    } finally {
        await browser?.close();
    }
}
