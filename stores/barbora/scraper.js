export async function extractProducts(page, baseUrl) {
    let products = [];
    
    try {
        const newProducts = await page.evaluate(() => {
            const items = [];
            const productElements = document.querySelectorAll('[id^="fti-product-card-category-page-"]');

            productElements.forEach(product => {
                const data = product.getAttribute('data-b-for-cart');
                if (data) {
                    const productInfo = JSON.parse(data);
                    const title = productInfo.title;

                    const retailPrice = productInfo.retail_price || productInfo.price;
                    let retailUnitPrice = productInfo.comparative_unit_price ? Math.round(parseFloat(productInfo.comparative_unit_price) * 100) / 100 : null;

                    let discountPriceAmount = null;
                    let discountUnitPrice = null;
                    let discount = null;
                    let loyaltyDiscount = null;

                    if (productInfo.promotion) {
                        if (productInfo.promotion.type === 'DISCOUNT_PRICE') {
                            discount = productInfo.promotion.percentage;
                            discountPriceAmount = Math.round(productInfo.price * 100) / 100;
                            discountUnitPrice = productInfo.comparative_unit_price ? Math.round(parseFloat(productInfo.comparative_unit_price) * 100) / 100 : null;
                            retailUnitPrice = productInfo.promotion.oldComparativeRate ? Math.round(parseFloat(productInfo.promotion.oldComparativeRate) * 100) / 100 : retailUnitPrice;
                        } else if (productInfo.promotion.type === 'LOYALTY_PRICE') {
                            loyaltyDiscount = productInfo.promotion.percentage;
                            discountUnitPrice = productInfo.comparative_unit_price ? Math.round(parseFloat(productInfo.comparative_unit_price) * 100) / 100 : null;

                        }
                    }

                    const productUrl = `https://barbora.lv/produkti/${productInfo.Url}`;
                    const unit = productInfo.comparative_unit;

                    items.push({
                        title,
                        unit: unit ? unit.trim() : '',
                        retailPrice: {
                            amount: retailPrice,
                            unitPrice: retailUnitPrice
                        },
                        discountPrice: {
                            amount: discountPriceAmount,
                            unitPrice: discountUnitPrice,
                            discount: discount
                        },
                        loyaltyPrice: {
                            amount: loyaltyDiscount ? Math.round(productInfo.price * 100) / 100 : null,
                            unitPrice: loyaltyDiscount ? discountUnitPrice : null,
                            discount: loyaltyDiscount
                        },
                        productUrl
                    });
                }
            });

            return items;
        });

        products = products.concat(newProducts);
    } catch (error) {
        throw new Error(`Error extracting products on page ${page.url()}: ${error.message}`);
    }

    return products;
}
export async function getNextPageLink(page) {
    try {
        const nextPageLink = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('a'));
            const nextPageElement = elements.find(element => element.textContent.includes('»'));
            return nextPageElement ? nextPageElement.href : null;
        });

        if (nextPageLink) {
            const currentPageUrl = new URL(page.url()).href;
            const nextPageUrl = new URL(nextPageLink, currentPageUrl).href;

            if (nextPageUrl === currentPageUrl) {
                return null;
            }
        }

        return nextPageLink;
    } catch (error) {
        throw new Error(`Error getting next page link on page ${page.url()}: ${error.message}`);
    }
}

