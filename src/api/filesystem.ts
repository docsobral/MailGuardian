import { readFile, mkdir, writeFile, readdir, unlink, rm } from 'node:fs/promises';
// import { AuthSessionMissingError, Session } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'path';
import { Broadcaster } from './broadcaster.js';
import { existsSync, Dirent } from 'node:fs';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import Cryptr from 'cryptr';

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeBackslashes(path: string): string {
  const pathArray: string[] = path.split('');
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

export async function getFile(fileType: 'html' | 'mjml', pathToRoot: string, marketo: boolean = false, fileName: string = 'index'): Promise<string> {
  let string: string;

  if (fileType === 'html') {
    string = (await readFile(pathToRoot + `\\${fileName}.html`)).toString();
    return string;
  }

  string = (await readFile(pathToRoot + `\\${marketo ? 'marketo' : fileName}.mjml`)).toString();
  return string;
}

export function getImage(path: string, imageName: string): Buffer {
  let image: Buffer;

  image = readFileSync(path + `\\img\\${imageName}`);
  return image;
}

export async function saveFile(path: string, name: string, file: string | Buffer): Promise<void> {
  await writeFile(`${path}\\${name}`, file);
}

export async function createFolders(templateName?: string): Promise<void> {
  // check if downloads folder exists
  if (!existsSync(__dirname + 'downloads')) {
    await mkdir(__dirname + 'downloads');
  }

  // check if temp folder exists
  if (!existsSync(__dirname + 'temp')) {
    await mkdir(__dirname + 'temp');
  }

  // check if template folder exists
  if (!existsSync(__dirname + 'templates')) {
    await mkdir(__dirname + 'templates');
  }

  // check if components folder exists
  if (!existsSync(__dirname + 'components')) {
    await mkdir(__dirname + 'components');
  }

  // check if tasks folder exists
  if (!existsSync(__dirname + 'tasks')) {
    await mkdir(__dirname + 'tasks');
  }
}

export async function createFolder(folderPath: string, broadcaster: Broadcaster, type: 'task' | 'email'): Promise<void> {
  const taskName = folderPath.split('\\')[5];
  const emailName = folderPath.split('\\')[6];
  broadcaster.start(`Creating the ${type}: ${type === 'task' ? taskName : emailName}`);
  if (!existsSync(folderPath)) {
    try {
      await mkdir(folderPath);
      await delay(1000);
    } catch (e) {
      broadcaster.fail('Something went wrong!');
      broadcaster.error(e as string);
    }
  }
  broadcaster.succeed(`Created the ${type}: ${type === 'task' ? taskName : emailName}`);
}

export async function deleteFolder(folderPath: string, broadcaster: Broadcaster, type: 'task' | 'email'): Promise<void> {
  const taskName = folderPath.split('\\')[5];
  const emailName = folderPath.split('\\')[6];
  broadcaster.start(`Deleting the ${type}: ${type === 'task' ? taskName : emailName}`);
  if (existsSync(resolve(__dirname, folderPath))) {
    try {
      await rm(resolve(__dirname, folderPath), { recursive: true, force: true });
      await delay(1000);
    } catch (e) {
      broadcaster.fail('Something went wrong!');
      broadcaster.error(e as string);
    }
  }
  broadcaster.succeed(`Deleted the ${type}: ${type === 'task' ? taskName : emailName}`);
}

export async function getFolders(folderPath: string, broadcaster: Broadcaster): Promise<string[]> {
  const folders = await readdir(folderPath);
  return folders;
}

const newMJML =
`<mjml>
  <mj-head>
    <mj-style>
      @media (max-width: 480px) {
${' '.repeat(8)}
      }
    </mj-style>
  </mj-head>

  <mj-body background-color="#ffffff">
${' '.repeat(4)}
  </mj-body>
</mjml>`

export async function manageTemplate(name: string, remove: boolean, type: 'template' | 'component' | 'email', broadcaster: Broadcaster, taskName?: string, emailName?: string): Promise<void> {
  const option = remove ? 'Delet' : 'Creat';
  broadcaster.start(`${option}ing ${type} named ${name}`);
  await delay(1000);

  let manage: typeof mkdir | typeof rm;
  let options = {};

  if (!remove) {
    manage = mkdir;
  } else {
    manage = rm;
    options = { recursive: true, force: true };
  }

  if (type !== 'email') {
    await manage(__dirname + `${type}s\\${name}`, options);
    await manage(__dirname + `${type}s\\${name}\\img`, options);
  } else if (typeof taskName === 'string' && typeof emailName === 'string') {
    await manage(resolve(__dirname, 'tasks', taskName, emailName), options);
    await manage(resolve(__dirname, 'tasks', taskName, emailName, 'img'), options);
  }

  if (!remove && type !== 'email') {
    writeFileSync(__dirname + `${type}s\\${name}\\index.mjml`, newMJML);
  } else if (!remove && typeof taskName === 'string' && typeof emailName === 'string') {
    writeFileSync(resolve(__dirname, 'tasks', taskName, emailName, 'index.mjml'), newMJML);
  }

  broadcaster.succeed(`${option}ed ${type} named ${name} at ${__dirname}/${type}s/${name}.`);
}

export async function openVS(name: string, type: 'template' | 'component' | 'email', broadcaster: Broadcaster, taskName?: string, emailName?: string): Promise<void> {
  if (type !== 'email') {
    exec(`${process.platform === 'win32' ? 'code.cmd' : 'code'} "${__dirname}\\${type}s\\${name}"`, (error, stdout, stderr) => {
      if (error) {
        throw new Error(`Error executing the command: ${error.message}`);
      } else {
        broadcaster.indent = 3;
        broadcaster.inform('\n   Folder opened in VSCode.');
      }
    });
  }

  else {
    exec(`${process.platform === 'win32' ? 'code.cmd' : 'code'} "${__dirname}\\tasks\\${taskName}\\${emailName}"`, (error, stdout, stderr) => {
      if (error) {
        throw new Error(`Error executing the command: ${error.message}`);
      } else {
        broadcaster.indent = 3;
        broadcaster.inform('\n   Folder opened in VSCode.');
      }
    });
  }
}

export async function cleanTemp(): Promise<void> {
  const files = await readdir(__dirname + 'temp');

  for (let file of files) {
    await unlink(__dirname + `temp\\${file}`);
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

export async function getState(): Promise<AppState> {
  const config: AppConfig = JSON.parse((await readFile(__dirname + 'config\\config.json')).toString('utf8'));
  const cryptr = new Cryptr(config['SECRET_KEY']);

  let state: AppState = JSON.parse((await readFile(__dirname + 'config\\state.json')).toString('utf8'));

  // decrypts encrypted values (state[key][0] is encrypted if state[key][1] is true)
  Object.keys(state).forEach(key => {
    if (state[key][1]) {
      state[key] = [cryptr.decrypt(state[key][0].toString()), true];
    }
  })

  return state;
}

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

export function getConfigAndPath(): {config: AppConfig, paths: AppPaths} {
  const config: AppConfig = JSON.parse(readFileSync(__dirname + `config\\config.json`, { encoding: 'utf8' }));
  const paths: AppPaths = Object.entries(JSON.parse(readFileSync(__dirname + `config\\paths.json`, { encoding: 'utf8' })));

  return {config, paths}
}

export function save(type: 'paths' | 'config', key: string, value: string): void {
  let info: AppInfo = JSON.parse(readFileSync(__dirname + `config\\${type}.json`, { encoding: 'utf8' }));

  info[key as keyof AppInfo] = value;

  const infoString: string = JSON.stringify(info, null, 2);
  writeFileSync(__dirname + `config\\${type}.json`, infoString);
}

export function getVersion(): string {
  return `Current version is v${JSON.parse(readFileSync(resolve(__dirname, 'package.json'), { encoding: 'utf8' })).version}`;
}

// export function saveSession(session: Session): void {
//   const info = JSON.stringify(session, null, 2);
//   writeFileSync(resolve(__dirname, 'config/session.json'), info);
// }

// function isSession(session: Session): session is Session {
//   return session.refresh_token && session.access_token ? true : false;
// }

// export function getSession(): Session {
//   const session: any = JSON.parse(readFileSync(resolve(__dirname, 'config/session.json'), { encoding: 'utf8' }));

//   if (!(isSession(session))) {
//     throw new AuthSessionMissingError();
//   }

//   return session;
// }

export function getChildDirectories(path: string): string[] {
  return readdirSync(path, { withFileTypes: true })
      .filter((dirent: Dirent) => dirent.isDirectory())
      .map((dirent: Dirent) => dirent.name);
}