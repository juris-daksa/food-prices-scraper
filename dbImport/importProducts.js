import fs from 'fs';
import path from 'path';
import pkg from 'pg';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import inquirer from 'inquirer';
import { fileURLToPath } from 'url';

const { Client } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function upsertStore(storeName) {
    const result = await client.query('SELECT id FROM stores WHERE name = $1', [storeName]);
    if (result.rows.length > 0) {
        return result.rows[0].id;
    } else {
        const insertResult = await client.query('INSERT INTO stores (name) VALUES ($1) RETURNING id', [storeName]);
        return insertResult.rows[0].id;
    }
}

async function upsertCategory(categoryName) {
    const result = await client.query('SELECT id FROM categories WHERE name = $1', [categoryName]);
    if (result.rows.length > 0) {
        return result.rows[0].id;
    } else {
        const insertResult = await client.query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [categoryName]);
        return insertResult.rows[0].id;
    }
}

async function upsertProduct(product, storeId, categoryId) {
    const result = await client.query('SELECT id FROM products WHERE title = $1 AND store_id = $2', [product.title, storeId]);
    if (result.rows.length > 0) {
        const productId = result.rows[0].id;
        await client.query(
            'UPDATE products SET category_id = $1, product_url = $2 WHERE id = $3',
            [categoryId, product.productUrl, productId]
        );
        return productId;
    } else {
        const productId = uuidv4();
        await client.query(
            'INSERT INTO products (id, category_id, store_id, title, product_url) VALUES ($1, $2, $3, $4, $5)',
            [productId, categoryId, storeId, product.title, product.productUrl]
        );
        return productId;
    }
}

async function upsertCurrentPrice(productId, product, priceUpdatedDate) {
    const retailAmount = product.retailPrice?.amount ?? null;
    const retailUnitPrice = product.retailPrice?.unitPrice ?? null;
    const discountAmount = product.discountPrice?.amount ?? null;
    const discountUnitPrice = product.discountPrice?.unitPrice ?? null;
    const loyaltyAmount = product.loyaltyPrice?.amount ?? null;
    const loyaltyUnitPrice = product.loyaltyPrice?.unitPrice ?? null;
    const discountPercentage = product.discountPrice?.discount ?? null;
    const loyaltyDiscountPercentage = product.loyaltyPrice?.discount ?? null;
    const unit = product.unit ?? null;

    await client.query(
        'INSERT INTO current_extended_prices (product_id, retail_comparable_price, discount_comparable_price, loyalty_comparable_price, retail_price, discount_price, loyalty_price, discount_percentage, loyalty_discount_percentage, unit, date_updated) ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ' +
        'ON CONFLICT (product_id) DO UPDATE SET retail_comparable_price = $2, discount_comparable_price = $3, loyalty_comparable_price = $4, retail_price = $5, discount_price = $6, loyalty_price = $7, discount_percentage = $8, loyalty_discount_percentage = $9, unit = $10, date_updated = $11',
        [
            productId,
            retailUnitPrice,
            discountUnitPrice,
            loyaltyUnitPrice,
            retailAmount,
            discountAmount,
            loyaltyAmount,
            discountPercentage,
            loyaltyDiscountPercentage,
            unit,
            priceUpdatedDate
        ]
    );
}

async function importProductsFromFile(filePath) {
    const data = fs.readFileSync(filePath);
    const { dateTime, categories, storeName } = JSON.parse(data);

    console.log(`Importing data from file: ${filePath}`);
    console.log(`Store: ${storeName}`);
    console.log(`Date Updated: ${dateTime}`);

    const storeId = await upsertStore(storeName);
    let importedCount = 0;

    for (const [categoryName, products] of Object.entries(categories)) {
        const categoryId = await upsertCategory(categoryName);

        for (const product of products) {
            const productId = await upsertProduct(product, storeId, categoryId);
            await upsertCurrentPrice(productId, product, dateTime);
            importedCount++;
        }
    }

    console.log(`Import completed for file: ${filePath}`);
    console.log(`Number of items imported: ${importedCount}`);
}

async function main() {
    const outputDir = path.resolve(__dirname, process.env.OUTPUT_DIR);
    const files = fs.readdirSync(outputDir).filter(file => file.endsWith('.json'));

    const { selectedFiles } = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'selectedFiles',
            message: 'Select the JSON files to import',
            choices: files
        }
    ]);

    await client.connect();

    for (const file of selectedFiles) {
        const filePath = path.join(outputDir, file);
        console.log(`Processing file: ${filePath}`);
        await importProductsFromFile(filePath);
    }

    await client.end();
    console.log('All imports completed.');
}

main().catch(err => {
    console.error('Import failed:', err);
});
