#! /usr/bin/env node

import ora from "ora";
import chalk from "chalk";
import { resolve } from 'path';
import { writeFile } from 'node:fs/promises';
import { mkdirSync,  existsSync } from 'node:fs';
import { AppState, __dirname } from "../api/filesystem.js";
import { enquire, EnquireMessages, EnquireNames, EnquireTypes } from "../api/enquire.js";

const spinner = ora();
spinner.start(`${chalk.yellow('Installing MailGuardian...')}`);

try {
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
  };
}

catch (error) {
  spinner.fail(error as string);
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

await delay(2000);
spinner.suffixText = chalk.bgWhite.black(`\n\n${chalk.bgBlack('  ')}Now run \'${chalk.red('mg login <email> <passoword>')}\'.`);
spinner.suffixText += `\n\n${chalk.bgBlack('  ')}${chalk.bgRed.black.bold.underline('NOTICE: Only works with Gmail, and you must use an app password. To generate an app password, go to Manage you Google Account > Security > 2FA > App Passwords')}`;
spinner.succeed(`${chalk.yellow('Finished installing MailGuardian!')}`);

await delay(3000);