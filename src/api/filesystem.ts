import { enquire, EnquireMessages, EnquireNames, EnquireTypes } from './enquire.js';
import { readFile, mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import { dirname, resolve, basename } from 'path';
import { AppState } from '../lib/save.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

function escapeBackslashes(path: string) {
  const pathArray = path.split('');
  let newArray = [];

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
  };

  if (!existsSync(__dirname + 'config\\paths.json')) {
    writeFile(__dirname + 'config\\paths.json', JSON.stringify({}, null, 2));
  }

  if (!existsSync(__dirname + 'config\\state.json') || !existsSync(__dirname + 'config\\config.json')) {
    const initialState: AppState = {logged: [false, false]};
    writeFile(__dirname + 'config\\state.json', JSON.stringify(initialState, null, 2));

    const answers = await enquire([
      // {
      //   type: EnquireTypes.input,
      //   name: EnquireNames.supabaseKey,
      //   message: EnquireMessages.supabaseKey
      // },

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
      // 'SUPA_KEY': answers.supabaseKey,
      'SUPA_SECRET': answers.supabaseSecret,
      'SUPA_URL': answers.supabaseURL,
      'SECRET_KEY': answers.secretKey,
    }

    await writeFile(__dirname + 'config\\config.json', JSON.stringify(appConfigs, null, 2));
    console.log(`${chalk.yellow('Finished creating config files and terminating process. Now run \'mailer login <email> <passoword>\'.')}`);
    process.exit(1);
  }
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