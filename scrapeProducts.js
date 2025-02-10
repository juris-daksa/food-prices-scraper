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

    if (!brdConfig) {
        console.error('Error: BRD_CONFIG is not defined. Please check your .env file.');
        return { success: false, message: 'Missing BRD_CONFIG in .env file' };
    }

    try {
        const storeConfigs = await loadStoreConfigs();
        const store = await selectStore(storeConfigs);
        const config = storeConfigs[store];

        const selectedCategories = config.categories;
        let allProducts = [];
        let currentCategory = null;
        let currentPage = 1;
        let continueScraping = true;

        for (const { href, category } of selectedCategories) {
            currentCategory = category;
            const baseUrl = config.baseUrl;
            let absoluteLink = new URL(href, baseUrl).href;

            const dateTime = new Date();
            const partialFileName = `${store}-products-partial-${dateTime.toISOString().split('T')[0]}.json`;
            const partialOutputPath = resolve(__dirname, 'output', partialFileName);

            while (continueScraping) {
                ({ browser, page } = await resetSession(brdConfig, absoluteLink));

                try {
                    await page.goto(`${absoluteLink}?page=${currentPage}`, { waitUntil: "networkidle0", timeout: 60000 });

                    const { extractProducts, getNextPageLink } = await import(`./stores/${store}/scraper.js`);
                    const products = await extractProducts(page, baseUrl);
                    allProducts = allProducts.concat(products);

                    const output = {
                        dateTime,
                        storeName: store,
                        categories: { [currentCategory]: allProducts },
                        currentPage
                    };
                    fs.mkdirSync(resolve(__dirname, 'output'), { recursive: true });
                    fs.writeFileSync(partialOutputPath, JSON.stringify(output, null, 2));

                    const nextPageLink = await getNextPageLink(page);

                    console.log(`Next page link: ${nextPageLink}`);

                    if (nextPageLink) {
                        absoluteLink = new URL(nextPageLink, baseUrl).href;
                        currentPage += 1; // Move to the next page
                    } else {
                        break;
                    }
                } catch (error) {
                    const retry = await retryCategoryPrompt(category, error);
                    if (retry) {
                        continue; // Retry the same page
                    } else {
                        continueScraping = false; // Stop scraping
                        break;
                    }
                } finally {
                    await browser?.close();
                }
            }

            if (!continueScraping) break; // Stop scraping if user chose not to retry

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

        return { success: true, data: allProducts };
    } catch (error) {
        console.error('Export failed:', error);
        return { success: false, message: error.message };
    }
}
