import fs from 'fs';
import { resolve } from 'path';
import { getDirname } from './utils.js';

const __dirname = getDirname(import.meta.url);
const proxyFilePath = resolve(__dirname, 'proxies.json');

// Load proxies from a JSON file
async function loadProxies() {
    const data = fs.readFileSync(proxyFilePath, 'utf8');
    return JSON.parse(data).map(proxy => proxy.proxy);
}

// Get a random proxy
export async function getRandomProxy() {
    const proxies = await loadProxies();
    return proxies[Math.floor(Math.random() * proxies.length)];
}
