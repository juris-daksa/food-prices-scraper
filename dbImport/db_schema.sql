CREATE DATABASE food_prices_db;

\c food_prices_db;

CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    category_id INT,
    store_id INT,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (store_id) REFERENCES stores(id)
);

CREATE TABLE IF NOT EXISTS historical_prices (
    product_id UUID,
    date DATE,
    price NUMERIC(10, 2),
    retail_price NUMERIC(10, 2),
    discount INT,
    comparable_price NUMERIC(10, 2),
    unit VARCHAR(50),
    PRIMARY KEY (product_id, date),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS pdn_ids (
    product_id UUID PRIMARY KEY,
    matched_id INT,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

ALTER TABLE products
RENAME COLUMN slug TO product_url;

CREATE TABLE IF NOT EXISTS current_extended_prices (
    product_id UUID PRIMARY KEY,
    retail_comparable_price NUMERIC(10, 2),
    discount_comparable_price NUMERIC(10, 2),
    loyalty_comparable_price NUMERIC(10, 2),
    retail_price NUMERIC(10, 2),
    discount_price NUMERIC(10, 2),
    loyalty_price NUMERIC(10, 2),
    discount_percentage INT,
    loyalty_discount_percentage INT,
    unit VARCHAR(50),
    date_updated DATE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);
