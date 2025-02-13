# Food Prices Scraper

Food Prices Scraper is a Node.js application designed to scrape product prices from various e-stores. It supports resuming scraping from a partial state and includes error handling and retry mechanisms. Store-specific configurations are automatically loaded if provided in the right directory structure.

## Installation

1. **Clone the repository**:
    ```bash
    git clone https://github.com/juris-daksa/food-prices-scraper.git
    ```
2. **Install dependencies**:
    ```bash
    npm install
    ```
3. **Create a `.env` file**:
    Create a `.env` file in the root directory of your project with the following content:
    ```plaintext
    BRD_CONFIG=your_brd_config_value
    ```

4. **Configure store settings**:
    Store settings are located in the `stores` directory. Each store should have a `config.json` file. Here's an example configuration:
    ```json
    {
        "baseUrl": "https://www.example.com",
        "categories": [
            {
                "relativeLink": "/products/category1",
                "category": "Category 1"
            },
            {
                "relativeLink": "/products/category2",
                "category": "Category 2"
            }
        ]
    }
    ```
## Folder structure

```
./
├── stores/
│   ├── foo_store/
│   │   ├── config.json
│   │   └── scraper.js
│   └── bar_store/
│       ├── config.json
│       └── scraper.js
├── output/
├── index.js
├── scrapeProducts.js
└── README.md
```

## Usage

1. **Run the scraper**:
    ```bash
    node index.js
    ```

2. **Select the e-store to scrape** when prompted.

3. **Monitor the console output** for progress and any errors. The scraper will retry up to 3 times in case of an error.

## Requirements

- Node.js (v18.19.0 or later)
- npm (Node Package Manager)
- BrightData account and web scraper instance
- `scraper.js` file for each store which exports the following functions:
    - `extractProducts(page)`
    - `getNextPageLink(page)`

## Logs and Outputs

- The scraper saves partial progress to the `output` directory with filenames in the format `store-products-partial-YYYY-MM-DD.json`.
- Final results are saved in the `output` directory with filenames in the format `store-products-YYYY-MM-DD.json`.

## Error Handling

- The scraper retries scraping up to 3 times in case of an error. If it fails after 3 attempts, the scraper will exit with an error message.
- Errors and progress are logged to the console, including page indicators and retry attempts.

## Contributing

Contributions are welcome! Please fork the repository and create a pull request with your changes.

## License

This project is licensed under the GPL-3.0 License.
