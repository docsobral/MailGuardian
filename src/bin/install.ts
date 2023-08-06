#! /usr/bin/env node

import chalk from "chalk";
import { mkdirSync,  existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'path';
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