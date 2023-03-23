import { enquire, PromptMessages, PromptNames, PromptTypes } from '../api/enquire.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import __dirname from '../api/dirname.js';
import Cryptr from 'cryptr';
import chalk from 'chalk';

export type AppState = {
  [key: string]: [(string | boolean), boolean] | string;
}

export async function checkFirstUse(): Promise<void> {
  if (!existsSync(__dirname + 'config')) {
    console.log(`${chalk.blue('Creating save files...\n')}`);
    mkdirSync(__dirname + 'config');
  };

  if (!existsSync(__dirname + 'config\\state.json') || !existsSync(__dirname + 'config\\config.json')) {
    const initialState: AppState = {logged: [false, false]};
    writeFileSync(__dirname + 'config\\state.json', JSON.stringify(initialState, null, 2));

    const answers = await enquire([
      {
        type: PromptTypes.input,
        name: PromptNames.supabaseKey,
        message: PromptMessages.supabaseKey
      },
      {
        type: PromptTypes.input,
        name: PromptNames.supabaseSecret,
        message: PromptMessages.supabaseSecret
      },
      {
        type: PromptTypes.input,
        name: PromptNames.supabaseURL,
        message: PromptMessages.supabaseURL
      },
      {
        type: PromptTypes.input,
        name: PromptNames.secretKey,
        message: PromptMessages.secretKey
      }
    ]);

    const appConfigs = {
      'SUPA_KEY': answers.supabaseKey,
      'SUPA_SECRET': answers.supabaseSecret,
      'SUPA_URL': answers.supabaseURL,
      'SECRET_KEY': answers.secretKey,
    }

    writeFileSync(__dirname + 'config\\config.json', JSON.stringify(appConfigs, null, 2));
    console.log(`${chalk.yellow('Finished creating config files and terminating process. Run the previous command again...')}`);
    process.exit(1);
  }
}

export async function getState(): Promise<AppState> {
  await checkFirstUse();

  const config = JSON.parse(readFileSync(__dirname + 'config\\config.json', { encoding: 'utf8' }));
  const cryptr = new Cryptr(config['SECRET_KEY']);

  let state: AppState = JSON.parse(readFileSync(__dirname + 'config\\state.json', { encoding: 'utf8' }));

  // decrypts encrypted values (state[key][0] is encrypted if state[key][1] is true)
  Object.keys(state).forEach(key => {
    if (state[key][1]) {
      state[key] = [cryptr.decrypt(state[key][0].toString()), true];
    }
  })

  return state;
}

export function saveState(key: string, value: string | boolean, encrypt = false): void {
  const config = JSON.parse(readFileSync(__dirname + 'config\\config.json', { encoding: 'utf8' }));
  const cryptr = new Cryptr(config['SECRET_KEY']);

  let finalValue: string;
  let state: AppState = JSON.parse(readFileSync(__dirname + 'config\\state.json', { encoding: 'utf8' }));

  if (encrypt && typeof value === 'string') {
    finalValue = cryptr.encrypt(value);
    state[key] = [finalValue, encrypt];
  } else {
    state[key] = [value, encrypt];
  }

  const stateString = JSON.stringify(state, null, 2);
  writeFileSync(__dirname + 'config\\state.json', stateString);
}