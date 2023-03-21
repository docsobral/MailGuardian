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
.command('login')
.description('Valitades and stores sender email address credentials')
.argument('<id>', 'User ID e.g. email@address.com')
.argument('<password>', 'If you use 2FA, your regular password will not work')
.action((id, password) => {
  isLoggedIn(id, password);
});

program
.command('export')
.description('Exports MJML project into host server')
.argument('<name>', 'Name of the bucket you want to export to')
.argument('[path]', '(Optional) Path to the folder where the files are located')
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

    console.log(`${chalk.yellow('\nCleaning bucket before upload...')}`);
    console.log(`${chalk.blue((await supabaseAPI.cleanFolder(name)).data?.message)}`);

    try {
      console.log(`${chalk.green('\nUploading mjml file...')}`);
      const upload = await supabaseAPI.uploadFile(mjml, 'index.mjml', name);
      if (upload.error) {
        throw new Error('Failed to upload mjml file!');
      }
      console.log(`${chalk.blue('Upload succesfull!')}`);
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
    }

    console.log(`${chalk.green('\nUploading images...')}`);
    Object.keys(images).forEach(async (imageName) => {
      try {
        const upload = await supabaseAPI.uploadFile(images[imageName], `img/${imageName}`, name, 'image/png');
        if (upload.error) {
          throw new Error(`Failed to upload ${imageName}! ${upload.error.message}`);
        }
        console.log(`${chalk.blue(`Succesfully uploaded ${imageName}`)}`);
      }

      catch (error) {
        console.error(`${chalk.red(error)}`);
      }
    });
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
        throw new Error('Operation cancelled by the user');
      }
    }

    catch (error) {
      console.error(`${chalk.magenta(error)}`);
      process.exit(1);
    }

    const mjml = await getMJML(path);
    const images = await getImages(path);

    console.log(`${chalk.yellow('\nCleaning bucket before upload...')}`);
    console.log(`${chalk.blue((await supabaseAPI.cleanFolder(name)).data?.message)}`);

    try {
      console.log(`${chalk.green('\nUploading mjml file...')}`);
      const upload = await supabaseAPI.uploadFile(mjml, 'index.mjml', name);
      if (upload.error) {
        throw new Error('Failed to upload mjml file!');
      }
      console.log(`${chalk.blue('Upload succesfull!')}`);
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
    }

    console.log(`${chalk.green('\nUploading images...')}`);
    Object.keys(images).forEach(async (imageName) => {
      try {
        const upload = await supabaseAPI.uploadFile(images[imageName], `img/${imageName}`, name, 'image/png');
        if (upload.error) {
          throw new Error(`Failed to upload ${imageName}! ${upload.error.message}`);
        }
        console.log(`Succesfully uploaded ${imageName}`);
      }

      catch (error) {
        console.error(`${chalk.red(error)}`);
      }
    });
  }
});

program
.command('bucket')
.description('Lists, creates or deletes a remote bucket')
.argument('[name]', 'Name of the bucket as it exists in the server')
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

program
.command('prepare')
.description('Parses MJML file into HTML according to provided parameters')
.argument('<name>', 'Name of the bucket where the MJML you want to parse is located')
.action(async (name) => {
  const mjml = await supabaseAPI.downloadFile(name, 'mjml');
  //@ts-ignore
  console.log(await mjml.data.text());
})


program.parse(process.argv);