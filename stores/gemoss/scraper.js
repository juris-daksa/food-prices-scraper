export async function extractProducts(page) {
	try {
		const items = await page.evaluate(() => {
			const products = [];
			const productElements = document.querySelectorAll("li.item.product");

			if (productElements.length === 0) {
				throw new Error("No products found on the page.");
			}

			productElements.forEach((product) => {
				const titleElement = product.querySelector(
					"strong.product-item-name a"
				);
				const oldPriceElement = product.querySelector(
					"span.old-price .price-wrapper .price"
				);
				const discountPriceElement = product.querySelector(
					"span.special-price .price-wrapper .price"
				);
				const finalPriceElement = product.querySelector(
					"span[data-price-type='finalPrice'] .price"
				);

				const title = titleElement ? titleElement.innerText.trim() : null;
				let retailPrice = finalPriceElement
					? parseFloat(
							finalPriceElement.innerText
								.replace(",", ".")
								.replace("€", "")
								.trim()
					  )
					: null;

				if (oldPriceElement) {
					retailPrice = parseFloat(
						oldPriceElement.innerText.replace(",", ".").replace("€", "").trim()
					);
				}

				let discountPrice = discountPriceElement
					? parseFloat(
							discountPriceElement.innerText
								.replace(",", ".")
								.replace("€", "")
								.trim()
					  )
					: null;

				const discountPercentage =
					retailPrice && discountPrice
						? Math.round(((retailPrice - discountPrice) / retailPrice) * 100)
						: null;

				const productUrl = titleElement ? titleElement.href : "";
				let unit = null;
				let unitSize = null;

				const weightMatches = title.match(/(\d+[.,]?\d*)\s?(kg|g)\b/gi);
				const volumeMatches = title.match(/(\d+[.,]?\d*)\s?(l|ml)\b/gi);
				const pieceMatch = title.match(/(\d+)\s?gab\./i);
				const multiPackMatch = title.match(
					/(\d+[.,]?\d*)\s?(g|kg|ml|l)[xX](\d+)/i
				);
				const pieceMultiMatch = title.match(/(\d+)\s?x\s?(\d+)\s?gab\./i);

				if (pieceMultiMatch) {
					unitSize =
						parseInt(pieceMultiMatch[1]) * parseInt(pieceMultiMatch[2]);
					unit = "gab.";
				} else if (multiPackMatch) {
					unitSize =
						parseFloat(multiPackMatch[1].replace(",", ".")) *
						parseInt(multiPackMatch[3]);
					unit = multiPackMatch[2].toLowerCase();
				} else if (weightMatches) {
					const weights = weightMatches.map((w) =>
						parseFloat(w.match(/\d+[.,]?\d*/)[0].replace(",", "."))
					);
					unitSize = Math.max(...weights);
					unit = weightMatches.some((w) => w.toLowerCase().includes("kg"))
						? "kg"
						: "g";
				} else if (volumeMatches) {
					const volumes = volumeMatches.map((v) =>
						parseFloat(v.match(/\d+[.,]?\d*/)[0].replace(",", "."))
					);
					unitSize = Math.max(...volumes);
					unit = volumeMatches.some((v) => v.toLowerCase().includes("ml"))
						? "ml"
						: "l";
				} else if (pieceMatch) {
					unitSize = parseInt(pieceMatch[1]);
					unit = "gab.";
				}

				if (unit === "g") {
					unitSize /= 1000;
					unit = "kg";
				} else if (unit === "ml") {
					unitSize /= 1000;
					unit = "l";
				}

				const unitPrice =
					unitSize && retailPrice
						? parseFloat((retailPrice / unitSize).toFixed(2))
						: retailPrice;
				const discountUnitPrice =
					unitSize && discountPrice
						? parseFloat((discountPrice / unitSize).toFixed(2))
						: discountPrice;

				products.push({
					title,
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
					unit,
					unitSize,
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
	return await page.evaluate(() => {
		const nextPageElement = document.querySelector("li.item.pages-item-next a");
		return nextPageElement ? nextPageElement.href : null;
	});
}
