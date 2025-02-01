export async function extractProducts(page, baseUrl) {
  let products = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
      const newProducts = await page.evaluate(() => {
          const items = [];
          const productElements = document.querySelectorAll('[id^="fti-product-card-category-page-"]');

          productElements.forEach(product => {
              const data = product.getAttribute('data-b-for-cart');
              if (data) {
                  const productInfo = JSON.parse(data);
                  const title = productInfo.title;
                  const price = productInfo.price;
                  const retailPrice = productInfo.retail_price;
                  const discount = productInfo.promotion ? productInfo.promotion.percentage : null;
                  const productUrl = productInfo.Url;
                  const unitPrice = productInfo.comparative_unit_price;
                  const unit = productInfo.comparative_unit;
                  items.push({ title, price, retailPrice, discount, productUrl, unitPrice, unit });
              }
          });

          return items;
      });

      products = products.concat(newProducts);

      const nextPageLink = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('a'));
          const nextPageElement = elements.find(element => element.textContent.includes('»'));
          return nextPageElement ? nextPageElement.href : null;
      });

      console.log(`Next page link: ${nextPageLink}`);

      if (nextPageLink) {
          const absoluteNextPageLink = new URL(nextPageLink, baseUrl).href;
          const nextPageNumber = new URL(absoluteNextPageLink).searchParams.get('page');
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
