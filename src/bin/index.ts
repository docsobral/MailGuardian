#! /usr/bin/env node
import chalk from 'chalk';
import { program } from 'commander';
import { enquire } from '../api/enquire.js';
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
.command('export <name> [path]')
.description('Exports MJML project into host server')
.action(async (name: string, path?: string) => {
  if (path) {
    let bucket: supabaseAPI.SupabaseStorageResult;

    try {
      bucket = await supabaseAPI.folderExists(name);
      if (bucket.error) {
        throw new Error('BUCKET ERROR: bucket doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a project.')
      }
    }

    catch (e) {
      console.error(`${chalk.red(e)}`);
      process.exit(1);
    }

    const mjml = await getMJML(path);
    const images = await getImages(path);

    // console.log(mjml);
    // console.log(images);
  } else {
    let bucket: supabaseAPI.SupabaseStorageResult;

    try {
      bucket = await supabaseAPI.folderExists(name);
      if (bucket.error) {
        throw new Error('BUCKET ERROR: bucket doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a project.')
      }
    }

    catch (e) {
      console.error(`${chalk.red(e)}`);
      process.exit(1);
    }

    try {
      path = await getPath();
      if (path === 'cancelled') {
        throw new Error('Cancelled by the user');
      }
    }

    catch (error) {
      console.error(`${chalk.magenta(error)}`);
      process.exit(1);
    }

    const mjml = await getMJML(path);
    const images = await getImages(path);

    // console.log(mjml);
    // console.log(images);


    // subir mjml em forma de arquivo de texto
    // subir imagens
    // checar se arquivos foram upados com sucesso
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