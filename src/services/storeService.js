import inquirer from 'inquirer';

export async function selectStore(storeConfigs) {
  const choices = Object.keys(storeConfigs).map(store => ({
    name: store.charAt(0).toUpperCase() + store.slice(1),
    value: store,
  }));

  if (!choices.length) {
    throw new Error("No store configurations found.");
  }

  const response = await inquirer.prompt([
    {
      type: 'list',
      name: 'store',
      message: 'Select the e-store to scrape',
      choices,
    },
  ]);
  return response.store;
}