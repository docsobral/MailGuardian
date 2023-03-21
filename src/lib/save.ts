import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import Cryptr from 'cryptr';
import env from '../api/dotenv.js';
import chalk from 'chalk';

if (typeof env.secretKey === 'undefined') {
  console.log(`${chalk.red('Missing secret key')}`);
  process.exit(1);
}

const cryptr = new Cryptr(env.secretKey);

export type AppState = {
  [key: string]: [(string | boolean), boolean] | string;
}

function checkFirstUse(): void {
  if (!existsSync('config')) {
    console.log(`${chalk.blue('Creating save files...\n')}`);
    mkdirSync('config');
  };

  if (!existsSync('config/state.json')) {
    const initialState: AppState = {logged: [false, false]};
    writeFileSync('config/state.json', JSON.stringify(initialState, null, 2));
  }
}

export function getState(): AppState {
  checkFirstUse();

  let state: AppState = JSON.parse(readFileSync('config/state.json', { encoding: 'utf8' }));

  // decrypts encrypted values (state[key][0] is encrypted if state[key][1] is true)
  Object.keys(state).forEach(key => {
    if (state[key][1]) {
      state[key] = [cryptr.decrypt(state[key][0].toString()), true];
    }
  })

  return state;
}

export function saveState(key: string, value: string | boolean, encrypt = false): void {
  checkFirstUse();

  let finalValue: string;
  let state: AppState = JSON.parse(readFileSync('config/state.json', { encoding: 'utf8' }));

  if (encrypt && typeof value === 'string') {
    finalValue = cryptr.encrypt(value);
    state[key] = [finalValue, encrypt];
  } else {
    state[key] = [value, encrypt];
  }

  const stateString = JSON.stringify(state, null, 2);
  writeFileSync('config/state.json', stateString);
}