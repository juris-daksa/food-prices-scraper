import { loadStoreConfigs } from '../services/storeConfigLoader.js';
import { selectStore } from '../services/storeService.js';
import { loadPartialData, saveDataToFile } from '../services/fileService.js';
import { resetSession } from '../services/browserService.js';
import config from '../config.js';

export async function scrapeProducts(mode) {
  try {
    const { storeConfigs, scrapers } = loadStoreConfigs();
    let browser, page;
    let selectedStores;
    let selectedCategories;
    let jsonFilePaths = [];

    if (mode === 'auto') {
      selectedStores = Object.keys(storeConfigs);
    } else {
      const store = await selectStore(storeConfigs);
      selectedStores = [store];
      selectedCategories = storeConfigs[store].categories;
    }

    for (const store of selectedStores) {
      try {
        const storeConfig = storeConfigs[store];
        const partialData = await loadPartialData(store);
        let allProducts = {};

        if (partialData) {
          allProducts = partialData.categories || {};
          selectedCategories = partialData.remainingCategories.length
            ? partialData.remainingCategories
            : storeConfig.categories;
        } else {
          selectedCategories = storeConfig.categories;
        }

        console.log(`Starting scraping for ${store}...`);

        const { extractProducts, getNextPageLink } = await scrapers[store];

        for (const { relativeLink, category } of selectedCategories) {
          if (!allProducts[category]) allProducts[category] = [];

          let absoluteLink = new URL(relativeLink, storeConfig.baseUrl).href;
          console.log(`Navigating to: ${absoluteLink}`);

          let success = false;
          let retryCount = 0;
          const maxRetries = 3;
          let useBrightData = false;

          while (retryCount < maxRetries) {
            try {
              ({ browser, page } = await resetSession(useBrightData ? config.BD_CONNECTION : null, absoluteLink));

              const products = await extractProducts(page);
              allProducts[category] = allProducts[category].concat(products);

              const nextPageLink = await getNextPageLink(page);

              const dateTime = new Date();
              const remainingCategories = [
                {
                  relativeLink: nextPageLink || relativeLink,
                  category,
                },
                ...selectedCategories.slice(selectedCategories.findIndex((cat) => cat.category === category) + 1),
              ];

              const output = {
                dateTime,
                storeName: store,
                categories: allProducts,
                remainingCategories,
              };

              const partialFileName = `${store}-products-partial-${dateTime.toISOString().split('T')[0]}.json`;
              const partialFilePath = saveDataToFile(config.OUTPUT_DIR, partialFileName, output)

              console.log(`✔ Scraped ${products.length} products at ".../${absoluteLink.split('/').pop()}", progress saved`);

              if (nextPageLink) {
                absoluteLink = new URL(nextPageLink, storeConfig.baseUrl).href;
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
          categories: allProducts,
        };

        const finalFileName = `${store}-products-${dateTime.toISOString().split('T')[0]}.json`;
        const finalOutputPath = saveDataToFile(config.OUTPUT_DIR, finalFileName, finalOutput);
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