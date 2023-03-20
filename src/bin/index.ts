#! /usr/bin/env node
import chalk from 'chalk';
import { program } from 'commander';
import { isLoggedIn } from '../lib/login.js';
import * as supabaseAPI from '../api/supabase.js';
import { existsSync, writeFileSync } from 'node:fs';
import { getMJML, getImages, getPath } from '../lib/export.js';

// if (!existsSync('config/paths.json')) {
//   writeFileSync('config/paths.json', JSON.stringify({path: `${__dirname} + test/`}, null, 2));
//   console.log(`${__dirname} + test/`);
// }

program.version('0.1');

program
.command('login <id> <password>')
.description('Valitades and stores sender email address credentials')
.action((id, password) => {
  isLoggedIn(id, password);
});

program
.command('export [path]')
.description('Exports MJML project into host server')
.action(async (path?: string) => {
  if (path) {
    const mjml = await getMJML(path);
    const images = await getImages(path);

    console.log(mjml);
    console.log(images);
  } else {
    const path = await getPath();
    const mjml = await getMJML(path);
    const images = await getImages(path);

    console.log(mjml);
    console.log(images);
  }
});

program
.command('bucket')
.description('Lists, creates or deletes a remote bucket')
.argument('[bucket name]', 'Name of the bucket as it exists in the server')
.option('-d, --delete', 'deletes a bucket')
.option('-c, --create', 'creates a bucket')
.action((name, options) => {
  if (options.create) {
    console.log(`${chalk.yellow(`Creating bucket named ${name}`)}`);
    supabaseAPI.createFolder(name);
    return
  }

  if (options.delete) {
    console.log(`${chalk.magenta(`Deleting bucket named ${name}`)}`);
    supabaseAPI.deleteFolder(name);
  }
});


program.parse(process.argv);