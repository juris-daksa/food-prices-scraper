import { scrapeProducts } from './scrapeProducts.js';
import { importScrapedData, interactiveImport } from './dbImport/importData.js';
import cron from 'node-cron';

const mode = process.argv[2] || 'interactive';

const scheduledTimes = [
  '00 8 * * *', // 8:00
  '30 18 * * *' // 18:30
];

const getNextRunTime = () => {
  const now = new Date();
  const nextRuns = scheduledTimes.map(time => {
    const nextRun = new Date(now);
    const [minute, hour] = time.split(' ');
    nextRun.setDate(now.getDate() + (now.getHours() > parseInt(hour, 10) || (now.getHours() === parseInt(hour, 10) && now.getMinutes() >= parseInt(minute, 10)) ? 1 : 0));
    nextRun.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
    return nextRun;
  });
  return nextRuns.sort((a, b) => a - b)[0];
};

const handleResult = async (result) => {
  if (result.success) {
    console.log('Scraping completed.');
    if (mode === 'auto') {
      await importScrapedData(result.jsonFilePaths);
      const nextRunTime = getNextRunTime();
      console.log(`Next scheduled scraping will happen at: ${nextRunTime}`);
    } else {
      await interactiveImport();
    }
  } else {
    console.error('Scraping failed:', result.message);
  }
};

const runScrapeProducts = (mode) => {
  scrapeProducts(mode)
    .then(handleResult)
    .catch(err => {
      console.error('Scraping failed:', err);
    });
};

if (mode === 'auto') {
  scheduledTimes.forEach(time => {
    cron.schedule(time, () => {
      console.log(`Running a scheduled scrape job at ${time}.`);
      runScrapeProducts('auto');
    });
  });
}

runScrapeProducts(mode);
