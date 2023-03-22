import chalk from 'chalk';
import dotenv from 'dotenv';
import { existsSync, writeFileSync } from 'node:fs';
import { enquire, PromptMessages, PromptNames, PromptTypes } from './enquire.js';

if (!existsSync('.env')) {
  console.error(`${chalk.red('Creating .env file...')}`);
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
  writeFileSync('.env', `NODE_PATH="BUILD"\nNODE_NO_WARNINGS=1\nSUPA_KEY="${answers.supabaseKey}"\nSUPA_SECRET="${answers.supabaseSecret}"\nSUPA_URL="${answers.supabaseURL}"\nSECRET_KEY="${answers.secretKey}"\nAUTHOR="<meta name="author" content="YOUR NAME">"`);
  process.exit(1);
}

dotenv.config();

type EnvParameters = {
  port?: string;
  supaKey?: string;
  supaSecret?: string;
  supaUrl?: string;
  secretKey?: string;
  author?: string;
}

const env: EnvParameters = {
  port: process.env.port,
  supaKey: process.env.supa_key,
  supaSecret: process.env.supa_secret,
  supaUrl: process.env.supa_url,
  secretKey: process.env.secret_key,
  author: process.env.author,
};

export default env;