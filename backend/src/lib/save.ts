import { __dirname, checkFirstUse } from '../api/filesystem.js';
import { readFileSync, writeFileSync } from 'node:fs';
import Cryptr from 'cryptr';

export type AppState = {
  [key: string]: [(string | boolean), boolean] | string;
}

export type AppConfig = {
  [key: string]: string;
}

export type AppPaths = [string, string][];

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

export function get(): {config: AppConfig, paths: AppPaths} {
  const config: AppConfig = JSON.parse(readFileSync(__dirname + `config\\config.json`, { encoding: 'utf8' }));
  const paths: AppPaths = Object.entries(JSON.parse(readFileSync(__dirname + `config\\paths.json`, { encoding: 'utf8' })));

  return {config, paths}
}

export function save(type: 'paths' | 'config', key: string, value: string): void {
  let info = JSON.parse(readFileSync(__dirname + `config\\${type}.json`, { encoding: 'utf8' }));

  info[key] = value;

  const string = JSON.stringify(info, null, 2);
  writeFileSync(__dirname + `config\\${type}.json`, string);
}