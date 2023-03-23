#! /usr/bin/env node
import chalk from 'chalk';
import { program } from 'commander';
import __dirname from '../api/dirname.js';
// import { enquire } from '../api/enquire.js';
import * as supabaseAPI from '../api/supabase.js';
import { downloadHTML, mailHTML } from '../lib/mail.js';
import { downloadMJML, parseMJML } from '../lib/prepare.js';
import { getMJML, getImages, getPath } from '../lib/export.js';
import { checkLoggedBeforeMail, isLoggedIn } from '../lib/login.js';
import { existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync, readFileSync } from 'node:fs';

// if (!existsSync('config/paths.json')) {
//   writeFileSync('config/paths.json', JSON.stringify({path: `${__dirname} + test/`}, null, 2));
//   console.log(`${__dirname} + test/`);
// }

program.version('0.2.5');

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
        console.log(`${chalk.blue('Succesfully uploaded', imageName)}`);
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
.option('-l, --list', 'lists all buckets')
.action(async (name, options) => {
  if (options.create) {
    console.log(`${chalk.yellow(`Creating bucket named ${name}`)}`);
    supabaseAPI.createFolder(name);
    return
  }

  if (options.delete) {
    console.log(`${chalk.magenta(`Deleting bucket named ${name}`)}`);
    supabaseAPI.deleteFolder(name);
    return
  }

  if (options.list) {
    try {
      const { data, error } = await supabaseAPI.listBuckets();
      if (error) {
        throw new Error(error.message);
      }

      if (data) {
        console.log(`${chalk.yellow('Buckets:')}`);
        for (let bucket of data) {
          console.log(`${chalk.blue('Name:', bucket.name)}`);
          console.log(`${chalk.blue('Created at:', bucket.created_at, '\n')}`);
        }
      }
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
      process.exit(1);
    }
  }
});

program
.command('prepare')
.description('Parses MJML file into HTML according to provided parameters')
.argument('<name>', 'Name of the bucket where the MJML you want to parse is located')
.option('-m, --marketo', 'parses MJML for Marketo', false)
.action(async (name, marketo: boolean) => {
  if (!existsSync(__dirname + 'temp')) {
    mkdirSync(__dirname + 'temp');
  }

  else {
    const files = readdirSync(__dirname + 'temp');
    for (let file of files) {
      unlinkSync(__dirname + 'temp\\' + file);
    }
  }

  if (marketo === true) {
    console.log('Marketo');
    return;
  }

  // regular parsing
  console.log(`${chalk.yellow('Fetching index.mjml file from the', name, 'bucket')}`)
  const mjmlBlob = await downloadMJML(name);
  if (mjmlBlob) {
    let mjmlString = await mjmlBlob.text()

    // prepare images src
    let imgList: string[] = [];
    let signedUrlList: string[] = [];

    try {
      const fetch = await supabaseAPI.listImages(name);
      if (fetch.error) {
        throw new Error('Failed to fetch list of image names!');
      }

      fetch.data.forEach(fileObject => imgList.push(fileObject.name));
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
      process.exit(1);
    }

    try {
      const fetch = await supabaseAPI.imagesUrls(name, imgList);
      if (fetch.error) {
        throw new Error('Failed to get signed URLs!');
      }

      fetch.data.forEach(object => signedUrlList.push(object.signedUrl));
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
    }

    for (let index in imgList) {
      const localPath = `(?<=src=")(.*)(${imgList[index]})(?=")`;
      const replacer = new RegExp(localPath, 'g');
      mjmlString = mjmlString.replace(replacer, signedUrlList[index]);
    };

    writeFileSync(__dirname + 'temp\\index.mjml', mjmlString);

    const finalMJML = parseMJML(readFileSync(__dirname + 'temp\\index.mjml'));
    writeFileSync(__dirname + 'temp\\index.html', finalMJML.html);

    try {
      const list = await supabaseAPI.listFiles(name);
      const exists = await supabaseAPI.fileExists('index.html', list.data);

      if (exists) {
        await supabaseAPI.deleteFile('index.html', name);
      }

      const results = await supabaseAPI.uploadFile(finalMJML.html, 'index.html', name);
      if (results.error) {
        throw new Error('Failed to upload HTML file!');
      }
      console.log(`${chalk.blue('Successfully parsed MJML and uploaded HTML to server')}`);
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
      process.exit(1);
    }
  }
});

program
.command('mail')
.description('Mails a HTML file to a recipient list')
.argument('<name>', 'Name of the bucket where the project is located')
.argument('<recipients>,', 'Recipient list (e.g. "davidsobral@me.com, davidcsobral@gmail.com"')
.action(async (name: string, recipientsString: string) => {
  const check = await checkLoggedBeforeMail();

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
  const htmlBlob = await downloadHTML(name);

  if (htmlBlob) {
    const htmlString = await htmlBlob.text();
    console.log(`${chalk.yellow('Sending email...')}`);
    try {
      await mailHTML(recipientsList, htmlString);
      console.log(`${chalk.blue('Success!')}`);
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
    }
  }
});


program.parse(process.argv);