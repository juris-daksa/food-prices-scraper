import { scrapeProducts } from './scrapeProducts.js';

scrapeProducts().then(result => {
    if (result.success) {
        console.log('Scraping completed.');
    } else {
        console.error('Scraping failed:', result.message);
    }
}).catch(err => {
    console.error('Scraping failed:', err);
});
