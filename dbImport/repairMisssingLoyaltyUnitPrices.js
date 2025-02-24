import fs from 'fs/promises';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const outputDir = process.env.OUTPUT_DIR;

async function getJsonFiles(directory) {
    const files = await fs.readdir(directory);
    return files.filter(file => file.endsWith('.json'));
}

async function processProducts(fileName) {
    try {
        const filePath = path.join(outputDir, fileName);
        const data = await fs.readFile(filePath, 'utf8');
        let parsedData = JSON.parse(data);

        let processedCount = 0;
        let repairedCount = 0;

        for (const category in parsedData.categories) {
            parsedData.categories[category].forEach(product => {
                if (product.loyaltyPrice && product.loyaltyPrice.amount !== null) {
                    processedCount++;
                    if (product.loyaltyPrice.unitPrice === null) {
                        const retailAmount = product.retailPrice.amount;
                        const retailUnitPrice = product.retailPrice.unitPrice;
                        const loyaltyAmount = product.loyaltyPrice.amount;

                        if (retailUnitPrice && retailAmount) {
                            product.loyaltyPrice.unitPrice = parseFloat(((loyaltyAmount / retailAmount) * retailUnitPrice).toFixed(2));
                            repairedCount++;
                        } else {
                            console.warn('Retail price amount or unitPrice is missing for product:', product.title);
                        }
                    }
                }
            });
        }

        console.log(`Processed ${processedCount} products.`);
        console.log(`Repaired loyaltyPrice.unitPrice for ${repairedCount} products.`);

        const outputFilePath = path.join(outputDir, `repaired_${fileName}`);
        await fs.writeFile(outputFilePath, JSON.stringify(parsedData, null, 2), 'utf8');
        console.log(`Repaired JSON data saved to ${outputFilePath}`);
    } catch (err) {
        console.error('Error processing the file:', err);
    }
}

async function main() {
    try {
        const jsonFiles = await getJsonFiles(outputDir);
        const { selectedFiles } = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'selectedFiles',
                message: 'Select JSON files to repair:',
                choices: jsonFiles,
            }
        ]);

        for (const fileName of selectedFiles) {
            await processProducts(fileName);
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

main();
