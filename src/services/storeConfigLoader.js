import fs from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const storesDir = resolve(__dirname, '../../stores');

export function loadStoreConfigs() {
  const storeDirs = fs.readdirSync(storesDir).filter((item) => {
    const fullPath = join(storesDir, item);
    return fs.lstatSync(fullPath).isDirectory();
  });

  const storeConfigs = {};
  const scrapers = {};

  for (const store of storeDirs) {
    const configFilePath = join(storesDir, store, 'config.json');
    if (fs.existsSync(configFilePath)) {
      try {
        const rawData = fs.readFileSync(configFilePath, 'utf-8');
        const config = JSON.parse(rawData);
        storeConfigs[store] = config;

        scrapers[store] = import(`../../stores/${store}/scraper.js`);
      } catch (error) {
        console.error(`Error parsing config for store '${store}':`, error);
      }
    } else {
      console.warn(`No config.json file found in ${configFilePath}`);
    }
  }

  return { storeConfigs, scrapers };
}