export async function extractProducts(page, baseUrl) {
    try {
        const items = await page.evaluate(() => {
            const products = [];
            const productElements = document.querySelectorAll('div.js-product-container');

            productElements.forEach(product => {
                const gtmEecProduct = product.getAttribute('data-gtm-eec-product');
                const productInfo = JSON.parse(gtmEecProduct);
                const productNameElement = product.querySelector('p.card__name');
                const title = productNameElement ? productNameElement.innerText : productInfo.name;

                let retailPrice = null;
                let retailUnitPrice = null;
                let discountPrice = null;
                let discountUnitPrice = null;
                let discountPercentage = null;
                let unit = '';

                // Check if the product has a discount price
                const priceWrapperElement = product.querySelector('div.card__price-wrapper');
                if (priceWrapperElement && priceWrapperElement.classList.contains('-has-discount')) {
                    const discountPriceSpan = product.querySelector('div.price-tag.card__price span');
                    const discountPriceSup = product.querySelector('div.price-tag.card__price sup');
                    if (discountPriceSpan && discountPriceSup) {
                        discountPrice = parseFloat(discountPriceSpan.innerText.replace(',', '.')) + parseFloat(`0.${discountPriceSup.innerText}`);
                        discountPrice = Math.round(discountPrice * 100) / 100;

                        const discountPricePerElement = product.querySelector('p.card__price-per');
                        const discountPricePerText = discountPricePerElement ? discountPricePerElement.innerText.replace(',', '.') : '';
                        if (discountPricePerText) {
                            [discountUnitPrice, unit] = discountPricePerText.split(' €/');
                            discountUnitPrice = parseFloat(discountUnitPrice);
                        }

                        const oldPriceElement = product.querySelector('div.old-price-tag.card__old-price span');
                        if (oldPriceElement) {
                            retailPrice = parseFloat(oldPriceElement.innerText.replace(',', '.'));
                            retailUnitPrice = (retailPrice / discountPrice) * discountUnitPrice;
                            retailUnitPrice = Math.round(retailUnitPrice * 100) / 100;
                            discountPercentage = Math.round(((retailPrice - discountPrice) / retailPrice) * 100);
                        }
                    }
                } else {
                    const priceSpanElement = product.querySelector('div.price-tag.card__price span');
                    const priceSupElement = product.querySelector('div.price-tag.card__price sup');
                    if (priceSpanElement && priceSupElement) {
                        const price = parseFloat(priceSpanElement.innerText.replace(',', '.')) + parseFloat(`0.${priceSupElement.innerText}`);
                        retailPrice = Math.round(price * 100) / 100;

                        const pricePerElement = product.querySelector('p.card__price-per');
                        const pricePerText = pricePerElement ? pricePerElement.innerText.replace(',', '.') : '';
                        if (pricePerText) {
                            [retailUnitPrice, unit] = pricePerText.split(' €/');
                            retailUnitPrice = parseFloat(retailUnitPrice);
                        }
                    }
                }

                // Extract loyalty price and its unit price
                const loyaltyPriceElement = product.querySelector('div.price-label[title*="MansRimi kartes lietotājiem"]');
                let loyaltyPrice = null;
                let loyaltyUnitPrice = null;
                let loyaltyDiscountPercentage = null;
                if (loyaltyPriceElement) {
                    const loyaltyMajorElement = loyaltyPriceElement.querySelector('div.price-label__price span.major');
                    const loyaltyMinorElement = loyaltyPriceElement.querySelector('div.price-label__price div.minor span.cents');
                    if (loyaltyMajorElement && loyaltyMinorElement) {
                        const loyaltyPriceValue = parseFloat(loyaltyMajorElement.innerText.replace(',', '.')) + parseFloat(`0.${loyaltyMinorElement.innerText}`);
                        loyaltyPrice = Math.round(loyaltyPriceValue * 100) / 100;

                        const loyaltyPricePerElement = loyaltyPriceElement.querySelector('div.price-per-unit');
                        const loyaltyPricePerText = loyaltyPricePerElement ? loyaltyPricePerElement.innerText.replace(',', '.') : '';
                        if (loyaltyPricePerText) {
                            const [loyaltyUnitPriceValue] = loyaltyPricePerText.split(' €/');
                            loyaltyUnitPrice = loyaltyUnitPriceValue ? parseFloat(loyaltyUnitPriceValue) : null;
                        }

                        if (retailPrice && loyaltyPrice) {
                            loyaltyDiscountPercentage = Math.round(((retailPrice - loyaltyPrice) / retailPrice) * 100);
                        }
                    }
                }

                const productUrl = product.querySelector('a.card__url') ? product.querySelector('a.card__url').href : '';

                products.push({
                    title, 
                    unit: unit ? unit.trim() : '',
                    retailPrice: {
                        amount: retailPrice,
                        unitPrice: retailUnitPrice
                    },
                    loyaltyPrice: {
                        amount: loyaltyPrice,
                        unitPrice: loyaltyUnitPrice,
                        discount: loyaltyDiscountPercentage
                    },
                    discountPrice: {
                        amount: discountPrice,
                        unitPrice: discountUnitPrice,
                        discount: discountPercentage
                    },
                    productUrl
                });
            });

            return products;
        });

        return items;
    } catch (error) {
        throw new Error(`Error extracting products on page ${page.url()}: ${error.message}`);
    }
}

export async function getNextPageLink(page) {
    try {
        const nextPageLink = await page.evaluate(() => {
            const nextPageElement = document.querySelector('a[aria-label*="Next"], a[rel="next"]');
            return nextPageElement ? nextPageElement.getAttribute('href') : null;
        });
        return nextPageLink;
    } catch (error) {
        throw new Error(`Error getting next page link on page ${page.url()}: ${error.message}`);
    }
}
