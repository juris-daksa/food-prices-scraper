export async function extractProducts(page, baseUrl) {
  try {
    const items = await page.evaluate(() => {
      const products = [];
      const productElements = document.querySelectorAll("div.item[data-row]");

      if (productElements.length === 0) {
        throw new Error("No products found on the page.");
      }

      productElements.forEach((product) => {
        const titleElement = product.querySelector(".img img");
        const brandElement = product.querySelector(".product-brand");
        const priceElement = product.querySelector(".product-price .price");
        const oldPriceElement = product.querySelector(".product-price .old-price");
        const productUrlElement = product.querySelector(".product-link");

        let title = titleElement ? titleElement.alt.trim().replace(/,/g, "") : null;
        const brand = brandElement ? brandElement.innerText.trim() : null;

        if (brand && brand !== "DAŽĀDI PRODUKTI" && title) {
          title = `${brand} ${title}`;
        }

        const productUrl = productUrlElement ? productUrlElement.href : "";

        let retailPrice = null;
        let discountPrice = null;
        
        if (oldPriceElement) {
          retailPrice = parseFloat(oldPriceElement.innerText.replace(",", ".").replace("EUR", "").trim());
          discountPrice = priceElement
            ? parseFloat(priceElement.innerText.replace(",", ".").replace("EUR", "").trim())
            : null;
        } else if (priceElement) {
          retailPrice = parseFloat(priceElement.innerText.replace(",", ".").replace("EUR", "").trim());
        }

        const discountPercentage = retailPrice && discountPrice
          ? Math.round(((retailPrice - discountPrice) / retailPrice) * 100)
          : null;

        let unit = null;
        let unitSize = null;

        const weightMatches = title.match(/(\d+(?:\.\d+)?)\s?(kg|g)\b/gi);
        const volumeMatches = title.match(/(\d+(?:\.\d+)?)\s?(l|ml)\b/gi);
        const pieceMatch = title.match(/(\d+)\s?gab\./i);

        if (pieceMatch) {
          unit = "gab."; 
          unitSize = parseInt(pieceMatch[1]);
        }


        if (volumeMatches) {
          unit = volumeMatches.some(v => v.toLowerCase().includes("ml")) ? "ml" : "l";
          unitSize = Math.max(...volumeMatches.map(v => parseFloat(v.match(/\d+/)[0])));
          if (unit === "ml") {
            unitSize /= 1000; 
            unit = "l";
          }
        }

        if (weightMatches) {
          unit = weightMatches.some(w => w.toLowerCase().includes("kg")) ? "kg" : "g";
          unitSize = Math.max(...weightMatches.map(w => parseFloat(w.match(/\d+/)[0])));
          if (unit === "g") {
            unitSize /= 1000;
            unit = "kg";
          }
        }

        let unitPrice = unitSize && retailPrice
          ? parseFloat((retailPrice / unitSize).toFixed(2)) 
          : retailPrice;

        let discountUnitPrice = unitSize && discountPrice
          ? parseFloat((discountPrice / unitSize).toFixed(2))
          : discountPrice;

        products.push({
          title,
          unit,
          retailPrice: {
            amount: retailPrice,
            unitPrice: unitPrice,
          },
          discountPrice: discountPrice
            ? {
                amount: discountPrice,
                unitPrice: discountUnitPrice,
                discount: discountPercentage,
              }
            : null,
          productUrl,
        });
      });

      return products;
    });

    return items;
  } catch (error) {
    throw new Error(
      `Error extracting products on page ${page.url()}: ${error.message}`
    );
  }
}

export async function getNextPageLink(page) {
  return null; 
}
