#! /usr/bin/env node

const { emitWarning } = process;

process.emitWarning = (warning, ...args) => {
  if (args[0] === 'ExperimentalWarning') {
    return;
  }

  if (args[0] && typeof args[0] === 'object' && args[0].type === 'ExperimentalWarning') {
    return;
  }
  // @ts-ignore
  return emitWarning(warning, ...args);
}

import chalk from 'chalk';
import { program } from 'commander';
import { save, get } from '../lib/save.js';
import { importBucket } from '../lib/import.js';
import { __dirname } from '../api/filesystem.js';
import * as supabaseAPI from '../api/supabase.js';
import { isLoggedIn, login } from '../lib/login.js';
import { downloadHTML, mailHTML } from '../lib/mail.js';
import { downloadMJML, parseMJML } from '../lib/prepare.js';
import { getMJML, getImages, getPath, watch } from '../lib/export.js';
import { enquire, EnquireMessages, EnquireNames, EnquireTypes } from '../api/enquire.js';
import { existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync, readFileSync } from 'node:fs';

program.version('0.6.8');

program
.command('login')
.description('Valitades and stores sender email address credentials')
.argument('<id>', 'User ID e.g. email@address.com')
.argument('<password>', 'If you use 2FA, your regular password will not work')
.action(async (id, password) => {
  try {
    const check = await isLoggedIn();

    if (check) {
      console.log(`${chalk.yellow('You are already logged in... do you want to change accounts?')}`);
      const { confirm } = await enquire([
        {
          type: EnquireTypes.confirm,
          name: EnquireNames.confirm,
          message: EnquireMessages.confirm
        }
      ]);

      if (confirm) {
        console.log(`${chalk.yellow('\nLogging in...')}`);
        const success = await login(id, password);
        if (!success) {
          throw new Error('Failed to login!');
        }
        console.log(`${chalk.blueBright('Success! Saving your credentials')}`);
      }

      else {
        console.log(`${chalk.red('\nAborting...')}`);
        process.exit();
      }
    }

    else {
      const success = await login(id, password);
      if (!success) {
        throw new Error('Failed to login!');
      }
      console.log(`${chalk.blueBright('Success! Saving your credentials')}`);
    }
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
    process.exit(1);
  }
});

program
.command('export')
.description('Exports MJML template into host server')
.argument('<name>', 'Name of the bucket you want to export to')
.argument('[path]', '(Optional) Path to the folder where the files are located')
.option('-w, --watch', 'Watches template\'s folder for changes and updates bucket accordingly')
.option('-n, --new-path', 'Ignore and overwrite current saved path')
.option('-m, --marketo', 'Exports marketo MJML')
.option('-c, --clean', 'Clean the bucket before export')
.option('-i, --images', 'Doesn\'t export images')
.action(async (name: string, path: string, options) => {
  const marketo = options.marketo ? true : false;

  try {
    const files = get();

    for (const entry of files.paths) {
      if (entry[0] === name && !options.newPath) {
        path = entry[1];
      }
    }

    if (options.clean) {
      console.log(`${chalk.yellow('\nCleaning bucket before upload...')}`);
      console.log(`${chalk.blue((await supabaseAPI.cleanFolder(name)).data?.message)}`);
    }

    if (path) {
      const check = existsSync(path);
      if (!check) {
        throw new Error('The path provided is broken')
      }
      save('paths', name, path);

      const bucket: supabaseAPI.SupabaseStorageResult = await supabaseAPI.folderExists(name);

      if (bucket.error) {
        throw new Error('BUCKET ERROR: bucket doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a project.')
      }

      if (options.watch) {
        await watch(path, name, marketo);
      }

      else {

        if (!options.marketo) {
          try {
            console.log(`${chalk.green('\nUploading mjml file...')}`);
            const mjml = await getMJML(path);
            const upload = await supabaseAPI.uploadFile(mjml, 'index.mjml', name, 'text/plain');
            if (upload.error) {
              throw new Error('Failed to upload mjml file!');
            }
            console.log(`${chalk.blue('Upload succesfull!')}`);
          }

          catch (error) {
            console.warn(`${chalk.red(error)}`);
          }
        }

        if (options.marketo) {
          try {
            console.log(`${chalk.green('\nUploading marketo mjml file...')}`);
            const marketoMJML = await getMJML(path, true);
            const upload = await supabaseAPI.uploadFile(marketoMJML, 'marketo.mjml', name, 'text/plain');
            if (upload.error) {
              throw new Error('Failed to upload marketo mjml file!');
            }
            console.log(`${chalk.blue('Upload succesfull!')}`);
          }

          catch (error) {
            console.warn(`${chalk.red(error)}`);
          }
        }

        const images = await getImages(path);

        if (!options.images) {
          console.log(`${chalk.green('\nUploading images...')}`);
          Object.keys(images).forEach(async (imageName) => {
            try {
              const upload = await supabaseAPI.uploadFile(images[imageName], `img/${imageName}`, name, 'image/png');
              if (upload.error) {
                throw new Error(`Failed to upload ${imageName}! ${upload.error.message}`);
              }
              console.log(`${chalk.blue('Succesfully uploaded', imageName)}`);
            }

            catch (error) {
              console.warn(`${chalk.red(error)}`);
            }
          });
        }
      }
    }

    else {
      let bucket: supabaseAPI.SupabaseStorageResult;

      bucket = await supabaseAPI.folderExists(name);
      if (bucket.error) {
        throw new Error('BUCKET ERROR: bucket doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a project.')
      }

      path = await getPath();

      if (path === 'cancelled') {
        throw new Error('Operation cancelled by the user');
      }

      const check = existsSync(path);

      if (!check) {
        throw new Error('The path provided is broken')
      }

      save('paths', name, path);

      if (options.watch) {
        await watch(path, name, marketo);
      }

      else {

        if (!options.marketo) {
          try {
            console.log(`${chalk.green('\nUploading mjml file...')}`);
            const mjml = await getMJML(path);
            const upload = await supabaseAPI.uploadFile(mjml, 'index.mjml', name, 'text/plain');
            if (upload.error) {
              throw new Error('Failed to upload mjml file!');
            }
            console.log(`${chalk.blue('Upload succesfull!')}`);
          }

          catch (error) {
            console.error(`${chalk.red(error)}`);
          }
        }

        if (options.marketo) {
          try {
            console.log(`${chalk.green('\nUploading marketo mjml file...')}`);
            const marketoMJML = await getMJML(path, true);
            const upload = await supabaseAPI.uploadFile(marketoMJML, 'marketo.mjml', name , 'text/plain');
            if (upload.error) {
              throw new Error('Failed to upload marketo mjml file!');
            }
            console.log(`${chalk.blue('Upload succesfull!')}`);
          }

          catch (error) {
            console.warn(`${chalk.red(error)}`);
          }
        }

        const images = await getImages(path);

        if (!options.images) {
          console.log(`${chalk.green('\nUploading images...')}`);
          Object.keys(images).forEach(async (imageName) => {
            try {
              const upload = await supabaseAPI.uploadFile(images[imageName], `img/${imageName}`, name, 'image/png');
              if (upload.error) {
                throw new Error(`Failed to upload ${imageName}! ${upload.error.message}`);
              }
              console.log(`${chalk.blue('Succesfully uploaded', imageName)}`);
            }

            catch (error) {
              console.warn(`${chalk.red(error)}`);
            }
          });
        }
      }
    }
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
    process.exit(1);
  }
});

program
.command('bucket')
.description('Lists, creates or deletes a remote bucket')
.argument('[name]', 'Name of the bucket as it exists in the server')
.option('-d, --delete', 'deletes a bucket')
.option('-c, --create', 'creates a bucket')
.action(async (name, options) => {
  try {
    if (options.create) {
      console.log(`${chalk.yellow(`Creating bucket named ${name}`)}`);
      const { data, error } = await supabaseAPI.createFolder(name);
      if (error) {
        throw new Error(`${error.stack?.slice(17)}`);
      }
      return;
    }

    if (options.delete) {
      console.log(`${chalk.magenta(`Deleting bucket named ${name}`)}`);
      const { data, error } = await supabaseAPI.deleteFolder(name);
      if (error) {
        throw new Error(`${error.stack?.slice(17)}`);
      }
      return;
    }

    const { data, error } = await supabaseAPI.listBuckets();

    if (error) {
      throw new Error(`${error.stack?.slice(17)}`);
    }

    if (data.length === 0) {
      console.log(`${chalk.yellow('There are no buckets')}`);
      return;
    }

    if (data) {
      console.log(`${chalk.yellow('Buckets:')}`);
      for (let index in data) {
        console.log(`${chalk.blue(data[index].name)}`);
      }
    }
  }

  catch (error) {
    console.log(`${chalk.red(error)}`);
    process.exit(1);
  }
});

program
.command('prepare')
.description('Parses MJML file into HTML according to provided parameters')
.argument('<name>', 'Name of the bucket where the MJML you want to parse is located')
.option('-m, --marketo', 'parses MJML for Marketo', false)
.action(async (name, options) => {
  try {
    // check is bucket exists
    const bucket = await supabaseAPI.folderExists(name);
    if (bucket.error) {
      throw new Error('BUCKET ERROR: bucket doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a template.')
    }

    // check if temp folder exists
    if (!existsSync(__dirname + 'temp')) {
      mkdirSync(__dirname + 'temp');
    }

    else {
      const files = readdirSync(__dirname + 'temp');
      for (let file of files) {
        unlinkSync(__dirname + 'temp\\' + file);
      }
    }

    // fetches mjml file
    const marketo = options.marketo ? true : false;
    console.log(`${chalk.yellow('Fetching MJML file from the', name, 'bucket')}`);
    const mjmlBlob = await downloadMJML(name, marketo);
    if (mjmlBlob) {
      let mjmlString = await mjmlBlob.text()
      let imgList: string[] = [];
      let signedUrlList: string[] = [];

      // get list of images
      const firstFetch = await supabaseAPI.listImages(name);
      if (firstFetch.error) {
        throw new Error('Failed to fetch list of image names!');
      }

      firstFetch.data.forEach(fileObject => imgList.push(fileObject.name));

      // get list of signes urls
      const secondFetch = await supabaseAPI.imagesUrls(name, imgList);
      if (secondFetch.error) {
        throw new Error('Failed to get signed URLs!');
      }

      secondFetch.data.forEach(object => signedUrlList.push(object.signedUrl));

      // replace local paths for remote paths
      for (let index in imgList) {
        const localPath = `(?<=src=")(.*)(${imgList[index]})(?=")`;
        const replacer = new RegExp(localPath, 'g');
        mjmlString = mjmlString.replace(replacer, signedUrlList[index]);
      };

      // save mjml with new paths
      writeFileSync(__dirname + 'temp\\source.mjml', mjmlString);

      const parsedHTML = parseMJML(readFileSync(__dirname + 'temp\\source.mjml', { encoding: 'utf8' }), marketo);
      writeFileSync(__dirname + `temp\\parsed.html`, parsedHTML);

      const list = await supabaseAPI.listFiles(name);
      const exists = await supabaseAPI.fileExists(`${options.marketo? 'marketo.html' : 'index.html'}`, list.data);

      if (exists) {
        await supabaseAPI.deleteFile(`${options.marketo? 'marketo.html' : 'index.html'}`, name);
      }

      const results = await supabaseAPI.uploadFile(readFileSync(__dirname + 'temp\\parsed.html', { encoding: 'utf8' }), `${options.marketo? 'marketo.html' : 'index.html'}`, name);
      if (results.error) {
        throw new Error('Failed to upload HTML file!');
      }
      console.log(`${chalk.blue('Successfully parsed MJML and uploaded HTML to server')}`);
    }
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
    process.exit(1);
  }
});

program
.command('mail')
.description('Mails a HTML file to a recipient list')
.argument('<name>', 'Name of the bucket where the template is located')
.argument('<recipients>', 'Recipient list (e.g. "davidsobral@me.com, davidcsobral@gmail.com"')
.option('-m, --marketo', 'sends the Marketo compatible HTML')
.action(async (name: string, recipientsString: string, options) => {
  try {
    const check = await isLoggedIn();

    const bucket = await supabaseAPI.folderExists(name);
    if (bucket.error) {
      throw new Error('BUCKET ERROR: bucket doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a template.')
    }

    if (typeof check === 'string') {
      process.exit(1);
    }

    if (typeof check === 'boolean') {
      if (!check) {
        console.error(`${chalk.red('Please log in with "mailer login" before trying to send an email')}`);
        process.exit(1);
      }
    }

    const recipientsList: string[] = recipientsString.split(', ')
    const htmlBlob = await downloadHTML(name, options.marketo);

    if (htmlBlob) {
      const htmlString = await htmlBlob.text();
      console.log(`${chalk.yellow('Sending email...')}`);
      await mailHTML(recipientsList, htmlString);
      console.log(`${chalk.blue('Success!')}`);
    }
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
    process.exit(1);
  }
});

enum Config {
  key = 'SUPA_KEY',
  secret = 'SUPA_SECRET',
  url = 'SUPA_URL',
  secretKey = 'SECRET_KEY',
  author = 'AUTHOR',
}

program
.command('config')
.description('Change the app\'s configurations')
.argument('<config>', 'The new config value')
.option('-k, --key', 'Change the supabase key')
.option('-s, --secret', 'Change the supabase secret')
.option('-u, --url', 'Change the supabase URL')
.option('-sk, --secret-key', 'Change the secret key')
.option('-a, --author', 'Change the content of the author meta tag')
.action(async (config, options) => {
  if (options) {
    const key: string = Object.keys(options)[0]

    try {
      console.log(`${chalk.yellow('Saving config...')}`);
      save('config', (key as keyof typeof Config).toUpperCase(), config);
      console.log(`${chalk.blue('Success!')}`);
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
    }
  }
});

program
.command('import')
.description('Fetch all files from a template bucket (including the .html file')
.argument('<name>', 'The bucket\'s name')
.option('-m, --marketo', 'Includes the marketo HTML')
.action(async (name, options) => {
  // check if bucket exists
  try {
    const bucket = await supabaseAPI.folderExists(name);
    if (bucket.error) {
      throw new Error('BUCKET ERROR: bucket doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a template.')
    }
  }

  catch (e) {
    console.error(`${chalk.red(e)}`);
    process.exit(1);
  }

  // check if downloads folder exists
  if (!existsSync(__dirname + 'downloads')) {
    mkdirSync(__dirname + 'downloads');
  }

  // check if template folder exists
  if (!existsSync(__dirname + `downloads\\${name}`)) {
    mkdirSync(__dirname + `downloads\\${name}`);
  }

  // check if downloads folder exists
  if (!existsSync(__dirname + `downloads\\${name}\\img`)) {
    mkdirSync(__dirname + `downloads\\${name}\\img`);
  }

  console.log(`${chalk.yellow(`Importing files:`)}`);
  const files = await importBucket(name, options.marketo ? true : false);

  try {
    Object.keys(files).forEach(key => {
      if (key === 'images') {
        // @ts-ignore
        for (let image of files[key]) {
          writeFileSync(__dirname + `downloads\\${name}\\img\\${image[0]}`, image[1])
        }
      }

      if (key === 'mjml') {
        // @ts-ignore
        writeFileSync(__dirname + `downloads\\${name}\\index.mjml`, files[key]);
      }

      if (key === 'mktomjml') {
        // @ts-ignore
        writeFileSync(__dirname + `downloads\\${name}\\marketo.mjml`, files[key]);
      }

      if (key === 'html') {
        // @ts-ignore
        writeFileSync(__dirname + `downloads\\${name}\\index.html`, files[key]);
      }

      if (key === 'mktohtml') {
        // @ts-ignore
        writeFileSync(__dirname + `downloads\\${name}\\marketo.html`, files[key]);
      }
    });
    console.log(`${chalk.blue('\nSuccess!')}`)
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
  }
});

program.parse(process.argv);