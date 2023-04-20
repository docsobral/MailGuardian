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

import ora from 'ora';
import chalk from 'chalk';
import { program } from 'commander';
import { BucketError } from '../lib/error.js';
import { importBucket } from '../lib/import.js';
import * as supabaseAPI from '../api/supabase.js';
import { isLoggedIn, login } from '../lib/login.js';
import { isStorageError } from '@supabase/storage-js';
import { downloadHTML, mailHTML } from '../lib/mail.js';
import { save, getConfigAndPath } from '../lib/save.js';
import { downloadMJML, parseMJML } from '../lib/prepare.js';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { __dirname, absolutePath, getFile } from '../api/filesystem.js';
import { getPath, watch, uploadMJML, uploadImages } from '../lib/export.js';
import { buildImage, convertHTML, isSpam, train } from '../api/spamassassin.js';
import { cleanTemp, createFolders, pathAndFile, saveFile } from '../api/filesystem.js';
import { enquire, EnquireMessages, EnquireNames, EnquireTypes } from '../api/enquire.js';

program.version('0.10.0');

program
.command('save-credentials')
.description('Valitades and stores sender email address credentials')
.argument('<id>', 'User ID e.g. email@address.com')
.argument('<password>', 'If you use 2FA, your regular password will not work')
.action(async (id: string, password: string) => {
  password = password.replace(/\\/g, '');
  console.log(password);

  try {
    const check = await isLoggedIn();

    if (check) {
      console.log(`${chalk.yellow('\nYou already have saved credentials... do you want to switch accounts?')}`);

      const { confirm } = await enquire([
        {
          type: EnquireTypes.confirm,
          name: EnquireNames.confirm,
          message: EnquireMessages.confirm
        }
      ]);

      if (confirm) {
        process.stdout.write('\n');
        const spinner = ora('Validating credentials...').start();

        if (!(await login(id, password))) {
          spinner.fail();
          throw new Error('Failed to login!');
        }

        spinner.succeed(`${chalk.green('Success! Your credentials were saved.')}`);
      }

      else {
        console.log(`${chalk.blueBright('Ok, exiting...')}`);
        process.exit();
      }
    }

    else {
      process.stdout.write('\n');
      const spinner = ora('Validating credentials...').start();

      if (await login(id, password)) {
        spinner.fail();
        throw new Error('Something went wrong... try again!');
      }

      spinner.succeed(`${chalk.blueBright('Success! Your credentials were saved.')}`);
    }
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
  }
});

program
.command('export')
.description('Exports MJML template into host server')
.argument('<name>', 'Name of the bucket you want to export to')
.argument('[path]', '(Optional) Path to the folder where the files are located')
.option('-w, --watch', 'Watches template\'s folder for changes and updates bucket accordingly', false)
.option('-n, --new-path', 'Ignore and overwrite current saved path', false)
.option('-m, --marketo', 'Exports marketo MJML', false)
.option('-c, --clean', 'Clean the bucket before export', false)
.option('-i, --images', 'Doesn\'t export images', false)
.action(async (name: string, path: string, options) => {
  try {
    const files = getConfigAndPath();

    // Checks if there is a path saved for the bucket and if there is, it will use it (if not, it will use the path provided by the user)
    // Skips if the user provided a path and the --new-path option
    // If the user provided a path and the --new-path option, it will overwrite the saved path
    // Refactor soon, because it will take too much CPU time once the number of buckets increases
    if (!path || options.newPath) {
      for (const entry of files.paths) {
        if (entry[0] === name) {
          path = absolutePath(entry[1]);
        }
      }
    }

    else {
      path = absolutePath(path);
    }

    if (options.clean) {
      process.stdout.write('\n');
      const spinner = ora(`${chalk.yellow('Cleaning bucket...')}`).start();
      const result = await supabaseAPI.cleanBucket(name);

      if (result.error) {
        spinner.fail('Failed to clean bucket!');
        process.exit(1);
      }

      spinner.succeed(`${chalk.green(result.data.message + ' bucket!')}`);
    }

    if (path) {
      const check = existsSync(path);
      if (!check) {
        throw new Error('The path provided is broken... try again!');
      }

      save('paths', name, path);

      const bucket: supabaseAPI.SupabaseStorageResult = await supabaseAPI.bucketExists(name);
      if (bucket.error) {
        throw new Error('BUCKET ERROR: bucket doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a template.');
      }

      if (options.watch) {
        await watch(path, name, options.marketo);
      }

      else {
        if (!options.marketo) {
          await uploadMJML(name, path);
        }

        else {
          await uploadMJML(name, path, true);
        }

        if (!options.images) {
          await uploadImages(name, path);
        }
      }
    }

    else {
      let bucket: supabaseAPI.SupabaseStorageResult;

      bucket = await supabaseAPI.bucketExists(name);
      if (bucket.error) {
        throw new BucketError(`Bucket ${name} doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a template.`);
      }

      path = await getPath();
      if (path === 'cancelled') {
        throw new Error('Operation cancelled by the user');
      }

      const check = existsSync(path);
      if (!check) {
        throw new Error('The path provided is invalid... try again!');
      }

      save('paths', name, path);

      if (options.watch) {
        await watch(path, name, options.marketo);
      }

      else {
        if (!options.marketo) {
          await uploadMJML(name, path);
        }

        else {
          await uploadMJML(name, path, true);
        }

        if (!options.images) {
          await uploadImages(name, path);
        }
      }
    }
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
  }
});

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

program
.command('bucket')
.description('Lists, creates or deletes a remote bucket')
.argument('[name]', 'Name of the bucket as it exists in the server')
.option('-d, --delete', 'deletes a bucket', false)
.option('-c, --create', 'creates a bucket', false)
.action(async (name: string, options: {delete: boolean, create: boolean}) => {
  try {
    if (options.create) {
      process.stdout.write('\n');
      const spinner = ora(`${chalk.yellow(`Creating bucket named ${name}`)}`).start();
      const { error } = await supabaseAPI.createBucket(name);
      if (error) {
        spinner.fail();
        throw new BucketError(`Failed to create bucket named ${name}! ${error.stack?.slice(17)}`);
      }
      spinner.succeed();
      return;
    }

    if (options.delete) {
      process.stdout.write('\n');
      const spinner = ora(`${chalk.yellow(`Deleting bucket named ${name}`)}`).start();
      const { error } = await supabaseAPI.deleteBucket(name);
      if (error) {
        spinner.fail();
        throw new BucketError(`Failed to delete bucket named ${name}! ${error.stack?.slice(17)}`);
      }
      spinner.succeed();
      return;
    }

    process.stdout.write('\n');
    const spinner = ora(`${chalk.yellow('Fetching buckets...')}`).start();
    const { data, error } = await supabaseAPI.listBuckets();

    if (error) {
      spinner.fail();
      throw new BucketError(`Failed to fetch buckets! ${error.stack?.slice(17)}`);
    }

    if (data.length === 0) {
      spinner.fail(`${chalk.red('There are no buckets in the server. Use \'mailer bucket -c [name]\' to create one.')}`);
      return;
    }

    spinner.succeed(`${chalk.yellow('Buckets:')}`);
    let count = 1;
    for (let index in data) {
      console.log(`  ${chalk.yellow(`${count}.`)} ${chalk.blue(data[index].name)}`);
      count++
    }
  }

  catch (error: any) {
    console.log(`${chalk.red(error)}`);
  }
});

program
.command('prepare')
.description('Parses MJML file into HTML according to provided parameters')
.argument('<name>', 'Name of the bucket where the MJML you want to parse is located')
.option('-m, --marketo', 'parses MJML for Marketo', false)
.action(async (name: string, options: {marketo: boolean}) => {
  try {
    // Check if bucket exists
    await supabaseAPI.bucketExists(name);

    // Prepare temp folder
    await createFolders(name);
    await cleanTemp();

    // fetches mjml file
    process.stdout.write('\n');
    const spinner = ora(`${chalk.yellow('Fetching and parsing MJML file from the', name, 'bucket...')}`).start();
    const mjmlBlob = await downloadMJML(name, options.marketo);

    if (mjmlBlob) {
      let mjmlString = await mjmlBlob.text()
      let imgList: string[] = [];
      let signedUrlList: string[] = [];

      // get list of images
      const firstFetch = await supabaseAPI.listImages(name);

      if (firstFetch.error) {
        spinner.fail();
        throw new Error(`Failed to fetch list of image names! ${firstFetch.error.stack?.slice(17)}`);
      }

      firstFetch.data.forEach(fileObject => imgList.push(fileObject.name));

      // get list of signes urls
      const secondFetch = await supabaseAPI.imagesUrls(name, imgList);

      if (secondFetch.error) {
        spinner.fail();
        throw new Error(`Failed to get signed URLs! ${secondFetch.error.stack?.slice(17)}`);
      }

      secondFetch.data.forEach(object => signedUrlList.push(object.signedUrl));

      // MOVE THIS FUNCTION TO A SEPARATE FILE
      // replace local paths for remote paths
      for (let index in imgList) {
        const localPath = `(?<=src=")(.*)(${imgList[index]})(?=")`;
        const replacer = new RegExp(localPath, 'g');
        mjmlString = mjmlString.replace(replacer, signedUrlList[index]);
      };

      // save mjml with new paths
      await saveFile(__dirname + 'temp\\', 'source.mjml', mjmlString);

      const parsedHTML = parseMJML(readFileSync(__dirname + 'temp\\source.mjml', { encoding: 'utf8' }), options.marketo);
      await saveFile(__dirname + 'temp\\', 'parsed.html', parsedHTML);

      const list = await supabaseAPI.listFiles(name);
      const exists = await supabaseAPI.fileExists(`${options.marketo? 'marketo.mjml' : 'index.mjml'}`, list.data);

      if (exists) {
        const result = await supabaseAPI.deleteFile(`${options.marketo? 'marketo.mjml' : 'index.mjml'}`, name);

        if (result.error) {
          spinner.fail();
          throw new Error(`Failed to delete ${options.marketo? 'marketo.mjml' : 'index.mjml'} file! ${result.error.stack?.slice(17)}`);
        }
      }

      else {
        throw new Error(`File ${options.marketo? 'marketo.mjml' : 'index.mjml'} does not exist!`);
      }

      const results = await supabaseAPI.uploadFile(readFileSync(__dirname + 'temp\\parsed.html', { encoding: 'utf8' }), `${options.marketo? 'marketo.html' : 'index.html'}`, name);

      if (results.error) {
        spinner.fail();
        throw new Error(`Failed to upload HTML file! ${results.error.stack?.slice(17)}`);
      }

      spinner.succeed(`${chalk.green('Successfully parsed MJML and uploaded HTML to server')}`);
    }
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
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

    if (!check) {
      console.error(`${chalk.red('\nPlease log in with "mailer login" before trying to send an email')}`);
      process.exit(1);
    }

    const bucket = await supabaseAPI.bucketExists(name);
    if (bucket.error) {
      throw new Error('\nBUCKET ERROR: bucket doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a template.')
    }

    const recipientsList: string[] = recipientsString.split(', ');

    process.stdout.write('\n');
    const spinner = ora(`${chalk.yellow('Fetching HTML file from the bucket')}`).start();
    const { data, error } = await downloadHTML(name, options.marketo);

    if (error) {
      spinner.fail();
      throw new Error('Failed to download HTML file!');
    }

    spinner.succeed();

    if (data) {
      const htmlString = await data.text();
      try {
        process.stdout.write('\n');
        const spinner = ora(`${chalk.yellow('Sending email...')}`).start();
        await mailHTML(recipientsList, htmlString);
        spinner.succeed();
      }

      catch (error) {
        spinner.fail();
        process.exit(1);
      }
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
      process.stdout.write('\n');
      const spinner = ora(`${chalk.yellow('Saving config...')}`).start();
      save('config', (key as keyof typeof Config).toUpperCase(), config);
      await delay(1000);
      spinner.succeed();
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
      process.exit(1);
    }
  }
});

program
.command('import')
.description('Fetch all files from a template bucket (including the .html file')
.argument('<name>', 'The bucket\'s name')
.action(async (name: string) => {
  // check if bucket exists
  try {
    const bucket = await supabaseAPI.bucketExists(name);
    if (bucket.error) {
      throw new Error('\nBUCKET ERROR: bucket doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a template.');
    }
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
    process.exit(1);
  }

  // Create template folders
  await createFolders(name);

  process.stdout.write('\n');
  const spinner = ora(`${chalk.yellow(`Importing files...`)}`).start();
  const files = await importBucket(name, true);

  if (isStorageError(files)) {
    spinner.fail();
    throw new Error(files.stack);
  }

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
    spinner.succeed();
  }

  catch (error) {
    spinner.fail();
    console.error(`${chalk.red(error)}`);
    process.exit(1);
  }
});

program
.command('spam')
.description('Runs commands related to Mailer\'s SpamAssassin functionalities')
.option('-b, --build', 'Builds the SpamAssassin image', false)
.option('-t, --test [path]', 'Runs a prepared email through SpamAssassin\'s tests', false)
.option('-l, --learn', 'Runs sa-learn on the Spam Assassin Public Corpus', false)
.action(async options => {
  if (options.build) {
    await buildImage();
  }

  if (options.test) {
    const pathToFile = options.test === true ? __dirname + 'temp\\parsed.html' : absolutePath(options.test);
    const [path, filename] = pathAndFile(pathToFile);
    const html = await getFile('html', path, false, filename);
    const RFC822 = await convertHTML(html);
    const rfcPath = __dirname + 'temp\\rfc822.txt'
    writeFileSync(rfcPath, RFC822);

    await isSpam(rfcPath);
  }

  if (options.learn) {
    await train();
  }
});

program.parse(process.argv);