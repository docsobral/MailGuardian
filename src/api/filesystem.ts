import { enquire, EnquireMessages, EnquireNames, EnquireTypes } from './enquire.js';
import { readFile, mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'url';
import Cryptr from 'cryptr';
import chalk from 'chalk';

function escapeBackslashes(path: string) {
  const pathArray = path.split('');
  let newArray: string[] = [];

  for (let char of pathArray) {
    char !== '\\' ? newArray.push(char) : newArray.push('\\\\');
  };

  return newArray.join('');
};

const __filename: string = dirname(fileURLToPath(import.meta.url));

export const __dirname: string = escapeBackslashes(__filename.split('build')[0]);

export function absolutePath(path: string): string {
  if (path.startsWith('C:\\')) {
    return path;
  } else {
    return resolve(__dirname, path);
  }
}

export function pathAndFile(path: string): [string, string] {
  return [dirname(path), basename(path)];
}

export async function getFile(fileType: 'html' | 'mjml', pathToFile: string, marketo: boolean = false, fileName: string = 'index'): Promise<string> {
  let string: string;

  if (fileType === 'html') {
    string = (await readFile(pathToFile + `\\${fileName}`)).toString();
    return string;
  }

  string = (await readFile(pathToFile + `\\${marketo ? 'marketo' : 'index'}.mjml`)).toString();
  return string;
}

export async function getHTML(path: string): Promise<string> {
  return (await readFile(path)).toString();
}

export async function getImage(path: string, imageName: string): Promise<Buffer> {
  let image: Buffer;

  image = await readFile(path + `\\img\\${imageName}`);
  return image;
}

export async function saveFile(path: string, name: string, file: string | Buffer): Promise<void> {
  await writeFile(`${path}\\${name}`, file);
}

export async function checkFirstUse(): Promise<void> {
  if (!existsSync(__dirname + 'config')) {
    console.log(`${chalk.blue('Creating save files...\n')}`);
    await mkdir(__dirname + 'config');

    writeFile(__dirname + 'config\\paths.json', JSON.stringify({}, null, 2));

    const initialState: AppState = {logged: [false, false]};
    writeFile(__dirname + 'config\\state.json', JSON.stringify(initialState, null, 2));

    const answers = await enquire([
      {
        type: EnquireTypes.input,
        name: EnquireNames.supabaseSecret,
        message: EnquireMessages.supabaseSecret
      },

      {
        type: EnquireTypes.input,
        name: EnquireNames.supabaseURL,
        message: EnquireMessages.supabaseURL
      },

      {
        type: EnquireTypes.input,
        name: EnquireNames.secretKey,
        message: EnquireMessages.secretKey
      }
    ]);

    const appConfigs = {
      'SUPA_SECRET': answers.supabaseSecret,
      'SUPA_URL': answers.supabaseURL,
      'SECRET_KEY': answers.secretKey,
    }

    await writeFile(__dirname + 'config\\config.json', JSON.stringify(appConfigs, null, 2));
    console.log(`${chalk.yellow('Finished creating config files and terminating process. Now run \'mailer login <email> <passoword>\'.')}`);
    process.exit(1);
  };
}

export async function createFolders(templateName: string): Promise<void> {
  // check if downloads folder exists
  if (!existsSync(__dirname + 'downloads')) {
    await mkdir(__dirname + 'downloads');
  }

  // check if template folder exists
  if (!existsSync(__dirname + `downloads\\${templateName}`)) {
    await mkdir(__dirname + `downloads\\${templateName}`);
  }

  // check if downloads folder exists
  if (!existsSync(__dirname + `downloads\\${templateName}\\img`)) {
    await mkdir(__dirname + `downloads\\${templateName}\\img`);
  }

  // check if temp folder exists
  if (!existsSync(__dirname + 'temp')) {
    await mkdir(__dirname + 'temp');
  }
}

export async function cleanTemp(): Promise<void> {
  const files = await readdir(__dirname + 'temp');

  for (let file of files) {
    await unlink(__dirname + `temp\\${file}`);
  }
}

// IMPLEMENT THIS
export async function cleanDownloads(): Promise<void> {
  const files = await readdir(__dirname + 'downloads');

  for (let file of files) {
    await unlink(__dirname + `downloads\\${file}`);
  }
}

export interface AppState {
  [key: string]: [(string | boolean), boolean] | string;
}

export interface AppConfig {
  [key: string]: string;
}

type AppInfo = AppState | AppConfig;

export type AppPaths = [string, string][];

/**
 * @description Takes the state of the app and returns it. It also decrypts any values that need to be decrypted.
 *
 * @example
 *
 * const state = await getState();
 * // Returns { 'logged' : [true, false], 'host': ['smtp.gmail.com', false], id: ['123456789', true], 'password': ['password', true]}
 *
 * @returns {Promise<AppState>} The state of the app
 */
export async function getState(): Promise<AppState> {
  const config: AppConfig = JSON.parse(readFileSync(__dirname + 'config\\config.json', { encoding: 'utf8' }));
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

/**
 * @description Saves the state of the app
 *
 * @remarks
 * This function takes the state of the app and saves it. It also encrypts any
 * values that need to be encrypted.
 *
 * @example
 * // Saves { 'logged' : [true, false], 'host': ['smtp.gmail.com', false], id: ['encrypted', true], 'password': ['encrypted', true]}
 * await saveState('logged': [true, false], 'host': ['smtp.gmail.com', false], id: ['123456789', true], 'password': ['password', true]])
 *
 * @example
 * // Saves { id: ['123456789', true]}
 * await saveState('id', '123456789', true);
 *
 * @param key The key of the state
 * @param value The value of the state
 * @param encrypt Whether or not to encrypt the value
 *
 * @returns {Promise<void>} - A promise that resolves when the state is saved
 */
export function saveState(key: string, value: string | boolean, encrypt = false): void {
  const config: AppConfig = JSON.parse(readFileSync(__dirname + 'config\\config.json', { encoding: 'utf8' }));
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

/**
 * @description Takes the config and paths of the app and returns them
 *
 * @returns {Promise<{config: AppConfig, paths: AppPaths}>} - The config and paths of the app
 *
 */
export function getConfigAndPath(): {config: AppConfig, paths: AppPaths} {
  const config: AppConfig = JSON.parse(readFileSync(__dirname + `config\\config.json`, { encoding: 'utf8' }));
  const paths: AppPaths = Object.entries(JSON.parse(readFileSync(__dirname + `config\\paths.json`, { encoding: 'utf8' })));

  return {config, paths}
}

/**
 * @description Saves the config and paths of the app
 *
 * @example
 *
 * // Saves { 'paths': { 'inbox': 'C:\\Users\\user\\Desktop\\inbox' } }
 * save('paths', 'inbox', 'C:\\Users\\user\\Desktop\\inbox');
 *
 * @param type - The type of config to save ('paths' or 'config')
 * @param key - The key of the config
 * @param value - The value of the config
 */
export function save(type: 'paths' | 'config', key: string, value: string): void {
  let info: AppInfo = JSON.parse(readFileSync(__dirname + `config\\${type}.json`, { encoding: 'utf8' }));

  info[key as keyof AppInfo] = value;

  const infoString: string = JSON.stringify(info, null, 2);
  writeFileSync(__dirname + `config\\${type}.json`, infoString);
}