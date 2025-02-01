import { scrapeProducts } from './scrapeProducts.js';

scrapeProducts().then(() => {
    console.log('Scraping completed.');
}).catch(err => {
    console.error('Scraping failed:', err);
});