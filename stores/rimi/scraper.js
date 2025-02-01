export async function extractProducts(page, baseUrl) {
  let products = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
      const newProducts = await page.evaluate(() => {
          const items = [];
          const productElements = document.querySelectorAll('div.js-product-container');

          productElements.forEach(product => {
              const gtmEecProduct = product.getAttribute('data-gtm-eec-product');
              const productInfo = JSON.parse(gtmEecProduct);
              const productNameElement = product.querySelector('p.card__name');
              const title = productNameElement ? productNameElement.innerText : productInfo.name;
              const priceSpanElement = product.querySelector('div.price-tag.card__price span');
              const priceSupElement = product.querySelector('div.price-tag.card__price sup');
              const price = priceSpanElement && priceSupElement
                  ? parseFloat(priceSpanElement.innerText.replace(',', '.')) + parseFloat(`0.${priceSupElement.innerText}`)
                  : productInfo.price;
              const roundedPrice = Math.round(price * 100) / 100;
              const oldPriceElement = product.querySelector('div.old-price-tag.card__old-price span');
              const retailPrice = oldPriceElement ? parseFloat(oldPriceElement.innerText.replace(',', '.')) : null;
              const discount = retailPrice ? Math.round(((retailPrice - roundedPrice) / retailPrice) * 100) : null;
              const pricePerElement = product.querySelector('p.card__price-per');
              const pricePerText = pricePerElement ? pricePerElement.innerText.replace(',', '.') : '';
              const [unitPrice, unit] = pricePerText.split(' €/');
              const productUrl = product.querySelector('a.card__url') ? product.querySelector('a.card__url').href : '';

              items.push({ 
                  title, 
                  price: roundedPrice, 
                  discount, 
                  productUrl, 
                  unitPrice: parseFloat(unitPrice), 
                  unit: unit ? unit.trim() : '',
                  retailPrice 
              });
          });

          return items;
      });

      products = products.concat(newProducts);

      const nextPageLink = await page.evaluate(() => {
          const nextPageElement = document.querySelector('a[aria-label*="Next"], a[rel="next"]');
          return nextPageElement ? nextPageElement.getAttribute('href') : null;
      });

      console.log(`Next page link: ${nextPageLink}`);

      if (nextPageLink) {
          const absoluteNextPageLink = new URL(nextPageLink, baseUrl).href;
          const nextPageNumber = new URL(absoluteNextPageLink).searchParams.get('currentPage');
          console.log(`Next page URL: ${absoluteNextPageLink}`);
          console.log(`Next page number: ${nextPageNumber}`);
          if (nextPageNumber && parseInt(nextPageNumber) > currentPage) {
              currentPage = parseInt(nextPageNumber);
              await Promise.all([
                  page.waitForNavigation(),
                  page.goto(`${absoluteNextPageLink}`, { waitUntil: "domcontentloaded", timeout: 60000 })
              ]);
          } else {
              hasNextPage = false;
          }
      } else {
          hasNextPage = false;
      }
  }

  return products;
}
