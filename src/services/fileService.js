import fs from 'fs';
import { resolve } from 'path';

export function saveDataToFile(directory, filename, data) {
  fs.mkdirSync(directory, { recursive: true });
  const filePath = resolve(directory, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

export function readFileAsJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function loadPartialData(__dirname, store) {
  const dateTime = new Date();
  const partialFileName = `${store}-products-partial-${dateTime.toISOString().split('T')[0]}.json`;
  const partialOutputPath = resolve(__dirname, '../../output', partialFileName);
  return fs.existsSync(partialOutputPath) ? JSON.parse(fs.readFileSync(partialOutputPath)) : null;
}