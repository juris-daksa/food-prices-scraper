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

async function retryCategoryPrompt(category, error) {
    console.error(`Error while extracting products from category "${category}": ${error.message}`);
    const response = await inquirer.prompt([
        {
            type: 'confirm',
            message: `Failed to extract products from category "${category}". Would you like to try again?`,
            name: 'retry',
            default: true
        }
    ]);

    return response.retry;
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
        let currentCategory = null;
        let currentPage = 1;

        for (const { href, category } of selectedCategories) {
            currentCategory = category;
            const baseUrl = config.baseUrl;
            const absoluteLink = new URL(href, baseUrl).href;

            while (true) {
                ({ browser, page } = await resetSession(brdConfig));

                await page.setRequestInterception(true);
                page.on('request', (req) => {
                    const resourceType = req.resourceType();
                    if (['image', 'stylesheet', 'font'].includes(resourceType)) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });

                await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1');

                try {
                    await page.goto(`${absoluteLink}?page=${currentPage}`, { waitUntil: "domcontentloaded", timeout: 60000 });
                    const { extractProducts } = await import(`./stores/${store}/scraper.js`);
                    const products = await extractProducts(page, baseUrl);
                    allProducts[category] = products;

                    const dateTime = new Date();
                    const output = {
                        dateTime,
                        storeName: store,
                        categories: allProducts,
                        currentCategory,
                        currentPage
                    };
                    const fileName = `${store}-products-partial-${dateTime.toISOString().split('T')[0]}.json`;
                    const outputPath = resolve(__dirname, 'output', fileName);
                    fs.mkdirSync(resolve(__dirname, 'output'), { recursive: true });
                    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
                    break;
                } catch (error) {
                    const retry = await retryCategoryPrompt(category, error);
                    if (!retry) {
                        break;
                    }
                } finally {
                    await browser?.close();
                }
            }

            currentPage = 1; 
        }

        const dateTime = new Date();
        const output = {
            dateTime,
            storeName: store,
            categories: allProducts
        };
        const fileName = `${store}-products-${dateTime.toISOString().split('T')[0]}.json`;
        const outputPath = resolve(__dirname, 'output', fileName);
        fs.mkdirSync(resolve(__dirname, 'output'), { recursive: true });
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

        return allProducts;
    } catch (error) {
        console.error('Export failed:', error);
    }
}