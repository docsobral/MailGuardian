#! /usr/bin/env node

import chalk from "chalk";
import { resolve } from 'path';
import { mkdirSync,  existsSync } from 'node:fs';
import { writeFile, readFile } from 'node:fs/promises';
import { AppState, __dirname } from "../api/filesystem.js";
import { enquire, EnquireMessages, EnquireNames, EnquireTypes } from "../api/enquire.js";

console.log('\nInstalling MailGuardian...');

if (!existsSync(resolve(__dirname, 'config'))) {
  console.log(`${chalk.blue('Creating save files...\n')}`);
  mkdirSync(__dirname + 'config');

  await writeFile(__dirname + 'config\\paths.json', JSON.stringify({}, null, 2));

  const initialState: AppState = {logged: [false, false]};

  await writeFile(__dirname + 'config\\state.json', JSON.stringify(initialState, null, 2));

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
  process.exit(0);
};

if (!existsSync(resolve(__dirname, 'node_modules/win-select-folder/dist/select-folder.d.ts'))) {
  const thing = 'export = selectFolder;\n\ntype FolderSelectOptions = {\n  root: string;\n  description: string;\n  newFolder: number;\n}\n\ndeclare function selectFolder(e: FolderSelectOptions, o?: any): Promise<string>;';

  await writeFile(resolve(__dirname, 'node_modules/win-select-folder/dist/select-folder.d.ts'), thing, { encoding: 'utf8' });
}

let TSCONFIG = JSON.parse(await readFile(resolve(__dirname, 'tsconfig.json'), { encoding: 'utf8' }));

TSCONFIG.compilerOptions.noEmitOnError = true;

TSCONFIG = JSON.stringify(TSCONFIG, null, 2);

await writeFile(resolve(__dirname, 'tsconfig.json'), TSCONFIG);