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

async function loadPartialData(store) {
    const dateTime = new Date();
    const partialFileName = `${store}-products-partial-${dateTime.toISOString().split('T')[0]}.json`;
    const partialOutputPath = resolve(__dirname, 'output', partialFileName);

    if (fs.existsSync(partialOutputPath)) {
        const partialData = JSON.parse(fs.readFileSync(partialOutputPath));
        console.log('Loaded partial data:', partialData);
        return {
            allProducts: partialData.categories[partialData.currentCategory] || [],
            currentPage: partialData.currentPage || 1,
            currentCategory: partialData.currentCategory || null,
            lastAbsoluteLink: partialData.lastAbsoluteLink || null,
            remainingCategories: partialData.remainingCategories || [],
        };
    }

    return {
        allProducts: [],
        currentPage: 1,
        currentCategory: null,
        lastAbsoluteLink: null,
        remainingCategories: [],
    };
}

export async function scrapeProducts() {
    let browser;
    let page;

    const brdConfig = process.env.BRD_CONFIG;

    if (!brdConfig) {
        return { success: false, message: 'Missing BRD_CONFIG in .env file' };
    }

    try {
        const storeConfigs = await loadStoreConfigs();
        const store = await selectStore(storeConfigs);
        const config = storeConfigs[store];

        const selectedCategories = config.categories;
        const partialData = await loadPartialData(store);
        let { allProducts, currentPage, currentCategory, lastAbsoluteLink, remainingCategories } = partialData;
        let continueScraping = true;

        console.log('Starting scraping...');

        const { extractProducts, getNextPageLink } = await import(`./stores/${store}/scraper.js`);

        if (remainingCategories.length === 0) {
            remainingCategories = selectedCategories.map(cat => ({ ...cat }));
        }

        for (const { href, category } of remainingCategories) {
            if (currentCategory && category !== currentCategory) {
                continue;
            }
            currentCategory = category;
            let absoluteLink = lastAbsoluteLink || new URL(href, config.baseUrl).href;
            console.log(`Navigating to: ${absoluteLink}`);

            while (continueScraping) {
                ({ browser, page } = await resetSession(brdConfig, absoluteLink));

                try {
                    const products = await extractProducts(page, config.baseUrl);
                    allProducts = allProducts.concat(products);

                    const nextPageLink = await getNextPageLink(page);
                    
                    if (!nextPageLink) {
                        const dateTime = new Date();
                        const output = {
                            dateTime,
                            storeName: store,
                            categories: { [currentCategory]: allProducts },
                            currentPage,
                            currentCategory,
                            lastAbsoluteLink: absoluteLink,
                            remainingCategories: remainingCategories.slice(remainingCategories.findIndex(cat => cat.category === currentCategory) + 1),
                        };
                        const partialFileName = `${store}-products-partial-${dateTime.toISOString().split('T')[0]}.json`;
                        const partialOutputPath = resolve(__dirname, 'output', partialFileName);
                        fs.mkdirSync(resolve(__dirname, 'output'), { recursive: true });
                        fs.writeFileSync(partialOutputPath, JSON.stringify(output, null, 2));
                        console.log('Saved partial output.');

                        break;
                    }

                    absoluteLink = new URL(nextPageLink, config.baseUrl).href;
                    currentPage += 1;
                    console.log(`Navigating to next page: ${absoluteLink}`);
                } catch (error) {
                    const retry = await retryCategoryPrompt(category, error);
                    if (retry) {
                        console.log(`Retrying category: ${category}`);
                        continue;
                    } else {
                        console.log(`Stopping scraping for category: ${category}`);
                        continueScraping = false;
                        break;
                    }
                } finally {
                    await browser?.close();
                }
            }

            if (!continueScraping) break;

            currentPage = 1;
        }

        const dateTime = new Date();
        const finalOutput = {
            dateTime,
            storeName: store,
            categories: { [currentCategory]: allProducts }
        };
        const finalFileName = `${store}-products-${dateTime.toISOString().split('T')[0]}.json`;
        const finalOutputPath = resolve(__dirname, 'output', finalFileName);
        fs.mkdirSync(resolve(__dirname, 'output'), { recursive: true });
        fs.writeFileSync(finalOutputPath, JSON.stringify(finalOutput, null, 2));
        console.log('Saved final output.');

        return { success: true, data: allProducts };
    } catch (error) {
        return { success: false, message: error.message };
    }
}
