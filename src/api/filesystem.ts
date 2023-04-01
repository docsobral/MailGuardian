import { enquire, PromptMessages, PromptNames, PromptTypes } from './enquire.js';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { AppState } from '../lib/save.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chalk from 'chalk';

function escapeBackslashes(path: string) {
  const pathArray = path.split('');
  let newArray = [];

  for (let char of pathArray) {
    char !== '\\' ? newArray.push(char) : newArray.push('\\\\');
  };

  return newArray.join('');
};

const __filename = dirname(fileURLToPath(import.meta.url));

export const __dirname = escapeBackslashes(__filename.split('build')[0]);

export async function getFile(type: 'html' | 'mjml', path: string, marketo: boolean = false): Promise<string> {
  let string: any;

  if (type === 'html') {
    try {
      string = await readFile(path + '\\index.html');
      return string.toString();
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
      process.exit(1);
    }
  }

  try {
    const name = marketo ? 'marketo' : 'index';
    string = (await readFile(path + `\\${name}.mjml`)).toString();
    return string.toString();
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
    process.exit(1);
  }
}

export async function getImage(path: string, imageName: string): Promise<Buffer> {
  let image: Buffer;
  try {
    image = await readFile(path + `\\img\\${imageName}`);
    return image;
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
    process.exit(1);
  }
}

export async function checkFirstUse(): Promise<void> {
  if (!existsSync(__dirname + 'config')) {
    console.log(`${chalk.blue('Creating save files...\n')}`);
    await mkdir(__dirname + 'config');
  };

  if (!existsSync(__dirname + 'config\\paths.json')) {
    await writeFile(__dirname + 'config\\paths.json', JSON.stringify({}, null, 2));
  }

  if (!existsSync(__dirname + 'config\\state.json') || !existsSync(__dirname + 'config\\config.json')) {
    const initialState: AppState = {logged: [false, false]};
    await writeFile(__dirname + 'config\\state.json', JSON.stringify(initialState, null, 2));

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

    await writeFile(__dirname + 'config\\config.json', JSON.stringify(appConfigs, null, 2));
    console.log(`${chalk.yellow('Finished creating config files and terminating process. Run the previous command again...')}`);
    process.exit(1);
  }
}