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

async function loadPartialData(store) {
  const dateTime = new Date();
  const partialFileName = `${store}-products-partial-${dateTime.toISOString().split('T')[0]}.json`;
  const partialOutputPath = resolve(__dirname, 'output', partialFileName);

  if (fs.existsSync(partialOutputPath)) {
    const partialData = JSON.parse(fs.readFileSync(partialOutputPath));
    return partialData;
  }
  return null;
}

export async function scrapeProducts(mode) {
  let browser;
  let page;

  const brdConfig = process.env.BRD_CONFIG;

  try {
    const storeConfigs = await loadStoreConfigs();
    let stores;
    let selectedCategories;
    let jsonFilePaths = [];

    if (mode === 'auto') {
      stores = Object.keys(storeConfigs);
    } else {
      const store = await selectStore(storeConfigs);
      stores = [store];
      selectedCategories = storeConfigs[store].categories;
    }

    for (const store of stores) {
      try {
        const config = storeConfigs[store];
        const partialData = await loadPartialData(store);
        let allProducts = {};

        if (partialData) {
          allProducts = partialData.categories || {};
          selectedCategories = partialData.remainingCategories.length ? partialData.remainingCategories : config.categories;
        } else {
          selectedCategories = config.categories;
        }

        console.log(`Starting scraping for ${store}...`);

        const { extractProducts, getNextPageLink } = await import(`./stores/${store}/scraper.js`);

        for (const { relativeLink, category } of selectedCategories) {
          if (!allProducts[category]) allProducts[category] = [];

          let absoluteLink = new URL(relativeLink, config.baseUrl).href;
          console.log(`Navigating to: ${absoluteLink}`);

          let retryCount = 0;
          const maxRetries = 3;
          let success = false;
          let useBrightData = false;

          while (retryCount < maxRetries) {
            try {
              ({ browser, page } = await resetSession(useBrightData ? brdConfig : null, absoluteLink));

              const products = await extractProducts(page);
              allProducts[category] = allProducts[category].concat(products);

              const nextPageLink = await getNextPageLink(page);

              const dateTime = new Date();
              const remainingCategories = [
                {
                  relativeLink: nextPageLink || relativeLink,
                  category
                },
                ...selectedCategories.slice(selectedCategories.findIndex(cat => cat.category === category) + 1)
              ];

              const output = {
                dateTime,
                storeName: store,
                categories: allProducts,
                remainingCategories
              };

              const partialFileName = `${store}-products-partial-${dateTime.toISOString().split('T')[0]}.json`;
              const partialOutputPath = resolve(__dirname, 'output', partialFileName);
              fs.mkdirSync(resolve(__dirname, 'output'), { recursive: true });
              fs.writeFileSync(partialOutputPath, JSON.stringify(output, null, 2));
              console.log(`✔ Scraped ${products.length} products at ".../${absoluteLink.split('/').pop()}", progress saved`);

              if (nextPageLink) {
                absoluteLink = new URL(nextPageLink, config.baseUrl).href;
                retryCount = 0;
              } else {
                success = true;
                break;
              }
            } catch (error) {
              console.error(`❌ Error during scraping attempt ${retryCount + 1}/${maxRetries} at ".../${absoluteLink.split('/').pop()}": `, error);

              if ((error.message.includes('403') || error.message.includes('429')) && !useBrightData) {
                console.log('Switching to Bright Data proxy due to access restrictions...');
                useBrightData = true;
                retryCount = 0;
              } else {
                retryCount++;
              }

              if (retryCount >= maxRetries) {
                console.error('Max retry limit reached for this category, moving to next.');
                break;
              }
            } finally {
              await browser?.close();
            }
          }
        }

        const dateTime = new Date();
        const finalOutput = {
          dateTime,
          storeName: store,
          categories: allProducts
        };
        const finalFileName = `${store}-products-${dateTime.toISOString().split('T')[0]}.json`;
        const finalOutputPath = resolve(__dirname, 'output', finalFileName);
        fs.mkdirSync(resolve(__dirname, 'output'), { recursive: true });
        fs.writeFileSync(finalOutputPath, JSON.stringify(finalOutput, null, 2));
        jsonFilePaths.push(finalOutputPath);
        console.log('Saved final output:', finalFileName);
      } catch (error) {
        console.error(`❌ Error scraping ${store}:`, error);
      }
    }

    return { success: true, jsonFilePaths }; 
  } catch (error) {
    return { success: false, message: error.message };
  }
}
