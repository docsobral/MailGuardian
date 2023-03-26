#! /usr/bin/env node
import chalk from 'chalk';
import { program } from 'commander';
import __dirname from '../api/dirname.js';
import { saveConfig } from '../lib/save.js';
import { importBucket } from '../lib/import.js';
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

program.version('0.5.1');

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
.action(async (name, options) => {
  // check is bucket exists
  try {
    const bucket = await supabaseAPI.folderExists(name);
    if (bucket.error) {
      throw new Error('BUCKET ERROR: bucket doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a project.')
    }
  }

  catch (e) {
    console.error(`${chalk.red(e)}`);
    process.exit(1);
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
  console.log(`${chalk.yellow('Fetching index.mjml file from the', name, 'bucket')}`);
  const mjmlBlob = await downloadMJML(name);
  if (mjmlBlob) {
    let mjmlString = await mjmlBlob.text()
    let imgList: string[] = [];
    let signedUrlList: string[] = [];

    // get list of images
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

    // get list of signes urls
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

    // replace local paths for remote paths
    for (let index in imgList) {
      const localPath = `(?<=src=")(.*)(${imgList[index]})(?=")`;
      const replacer = new RegExp(localPath, 'g');
      mjmlString = mjmlString.replace(replacer, signedUrlList[index]);
    };

    // save mjml with new paths
    writeFileSync(__dirname + 'temp\\index.mjml', mjmlString);

    if (options.marketo) {
      const parsedHTML = parseMJML(readFileSync(__dirname + 'temp\\index.mjml', { encoding: 'utf8' }), true);
      writeFileSync(__dirname + `temp\\parsed.html`, parsedHTML);
    }

    else {
      const parsedHTML = parseMJML(readFileSync(__dirname + 'temp\\index.mjml', { encoding: 'utf8' }));
      writeFileSync(__dirname + 'temp\\parsed.html', parsedHTML);
    }

    try {
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
.option('-m, --marketo', 'sends the Marketo compatible HTML')
.option('-t, --test', 'sends the sample email to a nodemailer test account')
.action(async (name: string, recipientsString: string, options) => {
  const check = await checkLoggedBeforeMail();

  try {
    const bucket = await supabaseAPI.folderExists(name);
    if (bucket.error) {
      throw new Error('BUCKET ERROR: bucket doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a project.')
    }
  }

  catch (e) {
    console.error(`${chalk.red(e)}`);
    process.exit(1);
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
    try {
      await mailHTML(recipientsList, htmlString);
      console.log(`${chalk.blue('Success!')}`);
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
    }
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
    const key: any = Object.keys(options)[0]

    try {
      console.log(`${chalk.yellow('Saving config...')}`);
      await saveConfig((key as keyof typeof Config).toUpperCase(), config);
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
      throw new Error('BUCKET ERROR: bucket doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a project.')
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

  console.log(`${chalk.yellow(`Importing files, ${options.marketo? 'including the Marketo HTML' : 'not including the Marketo HTML'}`)}`);
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

      if (key === 'index') {
        // @ts-ignore
        writeFileSync(__dirname + `downloads\\${name}\\index.mjml`, files[key]);
      }

      if (key === 'marketo') {
        // @ts-ignore
        writeFileSync(__dirname + `downloads\\${name}\\index.mjml`, files[key]);
      }
    });
    console.log(`${chalk.blue('Success!')}`)
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
  }
});

program.parse(process.argv);