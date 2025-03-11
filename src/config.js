import dotenv from 'dotenv';

dotenv.config();

const config = {
  BD_CONNECTION: process.env.BRD_CONFIG,
  OUTPUT_DIR: process.env.OUTPUT_DIR
};

export default config;