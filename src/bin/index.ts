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

import { program } from 'commander';
import { resolve } from 'node:path';
import { watchFile } from 'node:fs';
import { isStorageError } from '@supabase/storage-js';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';

import {
  BucketError
} from '../lib/error.js';

import {
  importBucket
} from '../lib/import.js';


import {
  isLoggedIn,
  login
} from '../lib/login.js';

import {
  downloadHTML,
  mailHTML
} from '../lib/mail.js';

import {
  downloadMJML,
  parseMJML
} from '../lib/prepare.js';

import {
  getPath,
  uploadMJML,
  uploadImages,
} from '../lib/export.js';

import {
  enquire,
  EnquireMessages,
  EnquireNames,
  EnquireTypes
} from '../api/enquire.js';

import {
  buildImage,
  convertHTML,
  isSpam,
  train,
  parseSpamAnalysis,
  generatePDF
} from '../api/spamassassin.js';

import {
  listComponents,
  importComponents
} from '../lib/append.js';

import {
  cleanTemp,
  createFolders,
  manageTemplate,
  pathAndFile,
  saveFile,
  __dirname,
  absolutePath,
  getFile,
  save,
  getConfigAndPath,
  getVersion,
  openVS,
} from '../api/filesystem.js';

import {
  compileHTML,
  CompilerOptions,
} from '../lib/build.js';

import { Broadcaster } from '../api/broadcaster.js';

export const broadcaster = new Broadcaster();

program.version(getVersion());

program
.command('save-credentials')
.description('Valitades and stores sender email address credentials')
.argument('<id>', 'User ID e.g. email@address.com')
.argument('<password>', 'If you use 2FA, your regular password will not work')
.action(async (id: string, password: string) => {
  password = password.replace(/\\/g, '');

  try {
    const check = await isLoggedIn();

    if (check) {
      broadcaster.inform('\nYou already have saved credentials... do you want to switch accounts?');

      const { confirm } = await enquire([
        {
          type: EnquireTypes.confirm,
          name: EnquireNames.confirm,
          message: EnquireMessages.confirm
        }
      ]);

      if (confirm) {
        broadcaster.start('Validating credentials...');

        if (!(await login(id, password))) {
          broadcaster.fail();
          throw new Error('Failed to login!');
        }

        broadcaster.succeed('Success! Your credentials were saved.');
      }

      else {
        broadcaster.calm('Ok, exiting...');
        process.exit();
      }
    }

    else {
      broadcaster.start('Validating credentials...');

      if (await login(id, password)) {
        broadcaster.fail();
        throw new Error('Something went wrong... try again!');
      }

      broadcaster.succeed('Success! Your credentials were saved.');
    }
  }

  catch (error) {
    broadcaster.error(error as string);
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
.action(async (
  name: string, path: string, options: { watch: boolean, newPath: boolean, marketo: boolean, clean: boolean, images: boolean}) => {
  try {
    const supabaseAPI = await import('../api/supabase.js');

    let bucket;

    bucket = await supabaseAPI.bucketExists(name);
    if (bucket.error) {
      throw new BucketError(`Bucket ${name} doesn\'t exist! Use \'mailer bucket -c <name>\' to create one before trying to export a template.`);
    }
    const files = getConfigAndPath();

    // Checks if there is a path saved for the bucket and if there is, it will use it (if not, it will use the path provided by the user)
    // Skips if the user provided a path and the --new-path option
    // If the user provided a path and the --new-path option, it will overwrite the saved path
    // Refactor soon, because it will take too much CPU time once the number of buckets increases
    if (!path && !options.newPath) {
      for (const entry of files.paths) {
        if (entry[0] === name) {
          path = absolutePath(entry[1]);
        }
      }
    }

    else if (path) {
      path = absolutePath(path);
    }

    else {
      path = await getPath();

      if (path === 'cancelled') {
        throw new Error('Operation cancelled by the user');
      }
    }

    if (options.clean) {
      broadcaster.start('Cleaning bucket...');
      const result = await supabaseAPI.cleanBucket(name);

      if (result.error) {
        broadcaster.fail('Failed to clean bucket!');
        throw new Error(result.error.stack);
      }

      broadcaster.succeed(result.data.message + ' bucket!');
    }

    const check = existsSync(path);
    if (!check) {
      throw new Error('The path provided is invalid... try again!');
    }

    save('paths', name, path);

    if (options.watch) {
      // await watch(path, name, options.marketo);
    }

    else {
      await uploadMJML(name, path, options.marketo);

      if (!options.images) {
        await uploadImages(name, path);
      }
    }
  }

  catch (error) {
    broadcaster.error(error as string);
  }
});

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

program
.command('template')
.description('Lists, creates or deletes a template')
.argument('[name]', 'Name of your template')
.option('-d, --delete', 'deletes a template', false)
.option('-c, --create [components]', 'creates a template', false)
.option('-l, --list', 'lists all templates', false)
.action(async (name: string, options: {delete: boolean, create: string, list: boolean}) => {
  try {
    const supabaseAPI = await import('../api/supabase.js');

    if (options.create) {
      if (existsSync(__dirname + `templates\\${name}`)) {
        openVS(name, 'template');
        return;
      }

      await supabaseAPI.manageBucket(name, 'create');
      await manageTemplate(name, false, 'template');
      await importComponents(options.create, name);

      openVS(name, 'template');

      return;
    }

    if (options.delete) {
      await manageTemplate(name, true, 'template');
      await supabaseAPI.manageBucket(name, 'delete');
      return;
    }

    if (options.list) {
      await listComponents();
    }

    if (existsSync(resolve(__dirname, `templates\\${name}`))) {
      openVS(name, 'template');
      return;
    }
  }

  catch (error: any) {
    broadcaster.error(error as string);
  }
});

program
.command('component')
.description('Lists, creates or deletes a component')
.argument('[name]', 'Name of the component')
.option('-d, --delete', 'deletes a template', false)
.option('-c, --create', 'creates a template', false)
.action(async (name: string, options: {delete: boolean, create: boolean}) => {
  try {
    await createFolders(name);

    if (options.create) {
      if (existsSync(resolve(__dirname, `components\\${name}`))) {
        openVS(name, 'component');

        return;
      }

      await manageTemplate(name, false, 'component');
      broadcaster.inform(`\nCreated component named ${name} at ${__dirname}\\components\\${name}. Opening in new VSCode window...`);
      await delay(1000);

      openVS(name, 'component');

      return;
    }

    if (options. delete) {
      await manageTemplate(name, true, 'component');
      broadcaster.inform(`\nDeleted component named ${name}.`);
    }
  }

  catch (error: any) {
    broadcaster.error(error);
  }
});

program
.command('build')
.description('Compiles MJML into HTML')
.argument('[path]', 'Path to the folder where the MJML file is located', resolve())
.option('-n, --name <name>', 'Specifies the name of the MJML file (e.g.: \'filename.mjml\')', 'index.mjml')
.option('-a, --author [taskCode]', 'Inserts Author meta tag into HTML', '')
.option('-i, --if', 'Inserts IF block', false)
.option('-w, --watch', 'Compiles file after every change', false)
.option('-l, --labels', 'Inserts labels in the final HTML', false)
.action(async (path: string, options: {name: string, author: string, if: boolean, watch: boolean, labels: boolean}) => {
  const compilerOptions: CompilerOptions = {
    folderPath: path,
    fileName: options.name.replace(/.mjml/, ''),
    insertAuthor: options.author ? true : false,
    taskCode: options.author,
    insertIF: options.if,
    watch: options.watch,
    insertLabels: options.labels,
  }

  if (options.watch) {
    const folderPath = path;
    const fileName: string = options.name;
    compilerOptions.insertLabels = false;

    let waiting = true;

    const watcher = watchFile(resolve(folderPath, fileName), async () => {
      if (waiting) return;
      waiting = true;

      const time = new Date();
      const hours = `${time.getHours()}:${time.getMinutes()}:${time.getSeconds()}`;
      broadcaster.appendSuffix(`\n  Change detected at ${hours}`, 'blue');
      const [result, error] = await compileHTML(compilerOptions);

      if (result === 'error') {
        broadcaster.fail(error);
      }

      setTimeout(() => {
        waiting = false;
      }, 5000);
    });

    watcher.once('start', async () => {
      const [result, error] = await compileHTML(compilerOptions);

      if (result === 'error') {
        broadcaster.fail(error);
      }

      broadcaster.set(`Now watching file: ${resolve(folderPath, fileName)}`, 'yellow');
      waiting = false;
    });

    process.stdout.write('\n');
    broadcaster.start(`Starting watcher...`);
    await delay(1000);

    watcher.emit('start');

    process.on('SIGINT', () => {
      broadcaster.appendSuffix('\n  Stopping the watcher...', 'red');
      broadcaster.succeed();
      watcher.removeAllListeners();
      process.exit(0);
    });
    return;
  }

  const [result, error, pathToHTML] = await compileHTML(compilerOptions);
  broadcaster.start('Compiling HTML...');
  await delay(500);

  if (result === 'error') {
    broadcaster.fail(error);
  } else {
    broadcaster.succeed(`Parsed MJML and saved HTML at ${pathToHTML}\n`);
  }
});

program
.command('prepare')
.description('Parses MJML file into HTML according to provided parameters')
.argument('<name>', 'Name of the bucket where the MJML you want to parse is located')
.option('-m, --marketo', 'parses MJML for Marketo', false)
.action(async (name: string, options: {marketo: boolean}) => {
  try {
    const supabaseAPI = await import('../api/supabase.js');

    await supabaseAPI.bucketExists(name);

    // Prepare temp folder
    await createFolders(name);
    await cleanTemp();

    broadcaster.start(`Fetching and parsing MJML file from the ${name} bucket...`);
    const mjmlBlob = await downloadMJML(name, options.marketo);

    if (mjmlBlob) {
      let mjmlString = await mjmlBlob.text()
      let imgList: string[] = [];
      let signedUrlList: string[] = [];

      const imageList = await supabaseAPI.listImages(name);

      if (imageList.error) {
        broadcaster.fail();
        broadcaster.error(`Failed to fetch list of image names! ${imageList.error.stack?.slice(17)}`);
      }

      // @ts-ignore
      imageList.data.forEach(fileObject => imgList.push(fileObject.name));
      const signedList = await supabaseAPI.imagesUrls(name, imgList);

      if (signedList.error) {
        broadcaster.fail();
        broadcaster.error(`Failed to get signed URLs! ${signedList.error.stack?.slice(17)}`);
      }

      // @ts-ignore
      signedList.data.forEach(object => signedUrlList.push(object.signedUrl));

      // MOVE THIS FUNCTION TO A SEPARATE FILE
      // replace local paths for remote paths
      for (let index in imgList) {
        const localPath = `(?<=src=")(.*)(${imgList[index]})(?=")`;
        const replacer = new RegExp(localPath, 'g');
        mjmlString = mjmlString.replace(replacer, signedUrlList[index]);
      };

      const __tempdirname = resolve(__dirname, 'temp')

      // save mjml with new paths
      await saveFile(__tempdirname, 'source.mjml', mjmlString);

      const parsedHTML = parseMJML(readFileSync(resolve(__tempdirname, 'source.mjml'), { encoding: 'utf8' }), options.marketo);
      await saveFile(__tempdirname, 'parsed.html', parsedHTML);

      const list = await supabaseAPI.listFiles(name);
      const exists = await supabaseAPI.fileExists(`${options.marketo? 'marketo.html' : 'index.html'}`, list.data);

      if (exists) {
        const result = await supabaseAPI.deleteFile(`${options.marketo? 'marketo.html' : 'index.html'}`, name);

        if (result.error) {
          broadcaster.fail();
          broadcaster.error(`Failed to delete ${options.marketo? 'marketo.html' : 'index.html'} file! ${result.error.stack?.slice(17)}`);
        }
      }

      const results = await supabaseAPI.uploadFile(readFileSync(resolve(__tempdirname, 'parsed.html'), { encoding: 'utf8' }), `${options.marketo? 'marketo.html' : 'index.html'}`, name);

      if (results.error) {
        broadcaster.fail();
        broadcaster.error(`Failed to upload HTML file! ${results.error.stack?.slice(17)}`);
      }

      broadcaster.succeed('Successfully parsed MJML and uploaded HTML to server');
    }
  }

  catch (error) {
    broadcaster.error(error as string);
  }
});

program
.command('send')
.description('Mails a HTML file to a recipient list')
.argument('<name>', 'Name of the bucket where the template is located')
.argument('<recipients>', 'Recipient list (e.g. "davidsobral@me.com, davidcsobral@gmail.com"')
.option('-m, --marketo', 'sends the Marketo compatible HTML', false)
.action(async (name: string, recipientsString: string, options: { marketo: boolean }) => {
  try {
    const supabaseAPI = await import('../api/supabase.js');

    const check: boolean = await isLoggedIn();
    if (!check) {
      broadcaster.error('Please enter valid email credentials with \'mailer save-credentials\' before trying to send an email');
    }

    const bucket = await supabaseAPI.bucketExists(name);
    if (bucket.error) {
      broadcaster.error('Bucket doesn\'t exist! Use \'mailer template <name> -c\' to create one before trying to export a template.');
    }

    const recipientsList = recipientsString.split(/ *, */);

    process.stdout.write('\n');
    broadcaster.start('Fetching HTML file from the bucket');

    const { data, error } = await downloadHTML(name, options.marketo);
    if (error) {
      broadcaster.fail();
      throw new Error('Failed to download HTML file!');
    }

    broadcaster.succeed();

    if (data) {
      const htmlString = await data.text();
      try {
        process.stdout.write('\n');
        broadcaster.start('Sending email...');
        await mailHTML(recipientsList, htmlString);
        broadcaster.succeed();
      }

      catch (error: any) {
        broadcaster.fail();
        console.error(error);
      }
    }
  }

  catch (error) {
    broadcaster.error(error as string);
  }
});

program
.command('send-html')
.argument('<recipients>', 'Recipient list')
.argument('<filename>', 'Name of the HTML file to be sent')
.action(async (recipients: string, filename: string) => {
  try {
    const path: string = await getPath();
    const list: string[] = recipients.split(/ *, */);
    const html: string = await getFile('html', path, false, filename);
    await mailHTML(list, html);
  }

  catch (error) {
    broadcaster.error(error as string);
  }
});

enum Config {
  secret = 'SUPA_SECRET',
  url = 'SUPA_URL',
  secretKey = 'SECRET_KEY',
  author = 'AUTHOR',
}

program
.command('config')
.description('Change the app\'s configurations')
.option('-s, --secret <config>', 'Change the supabase secret', false)
.option('-u, --url <config>', 'Change the supabase URL', false)
.option('-sk, --secret-key <config>', 'Change the secret key', false)
.option('-a, --author <config>', 'Change the content of the author meta tag', false)
.action(async (options: { secret: string, url: string, secretKey: string, author: string}) => {
  const key = Object.keys(options).find(key => !!options[key as keyof typeof options]);

  try {
    broadcaster.start('Saving config...');
    save('config', (key as keyof typeof Config).toUpperCase(), options[key as keyof typeof Config]);
    await delay(1000);
    broadcaster.succeed(`Saved ${broadcaster.color(key as string, 'green')} as ${broadcaster.color(options[key as keyof typeof Config], 'green')}`);
  }

  catch (error) {
    broadcaster.error(error as string);
  }
});

program
.command('import')
.description('Fetch all files from a template bucket (including the .html file')
.argument('<name>', 'The bucket\'s name')
.action(async (name: string) => {
  const supabaseAPI = await import('../api/supabase.js');

  const bucket = await supabaseAPI.bucketExists(name);
  if (bucket.error) {
    broadcaster.error('\nBUCKET ERROR: bucket doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a template.');
  }

  await createFolders(name);

  broadcaster.start(`Importing files...`);
  const files = await importBucket(name, true);

  if (isStorageError(files)) {
    broadcaster.fail();
    broadcaster.error(files.stack as string);
  }

  try {
    const __importdirname = resolve(__dirname, `downloads/${name}`);

    Object.keys(files).forEach(key => {
      if (key === 'images') {
        // @ts-ignore
        for (let image of files[key]) {
          writeFileSync(resolve(__importdirname, `img\\${image[0]}`), image[1])
        }
      }

      if (key === 'mjml') {
        // @ts-ignore
        writeFileSync(resolve(__importdirname, 'index.mjml'), files[key]);
      }

      if (key === 'mktomjml') {
        // @ts-ignore
        writeFileSync(resolve(__importdirname, 'marketo.mjml'), files[key]);
      }

      if (key === 'html') {
        // @ts-ignore
        writeFileSync(resolve(__importdirname, 'index.html'), files[key]);
      }

      if (key === 'mktohtml') {
        // @ts-ignore
        writeFileSync(resolve(__importdirname, 'marketo.html'), files[key]);
      }
    });

    broadcaster.succeed(`Imported files from ${broadcaster.color(name, 'green')} bucket to ${broadcaster.color(__importdirname, 'green')}`);
  }

  catch (error) {
    broadcaster.fail();
    broadcaster.error(error as string);
    process.exit(1);
  }
});

program
.command('spam')
.description('Runs commands related to Mailer\'s SpamAssassin functionalities')
.option('-b, --build', 'Builds the SpamAssassin image', false)
.option('-t, --test [path]', 'Runs a prepared email through SpamAssassin\'s tests', false)
.option('-l, --learn', 'Runs sa-learn on the Spam Assassin Public Corpus', false)
.option('-p, --pdf', 'Generates a PDF file from the results of the SpamAssassin tests', false)
.action(async (options: { build: boolean, test: boolean | string, learn: boolean, pdf: boolean}) => {
  try {
    if (options.build) {
      await buildImage();
    }

    if (options.test) {
      const pathToFile = options.test === true ? resolve(__dirname, 'temp/parsed') : absolutePath(options.test);
      const [path, filename] = pathAndFile(pathToFile);
      const html = await getFile('html', path, false, filename);
      const RFC822 = await convertHTML(html);
      const rfcPath = resolve(__dirname, 'temp/rfc822.txt');
      writeFileSync(rfcPath, RFC822);

      await isSpam(rfcPath);
    }

    if (options.learn) {
      await train();
    }

    if (options.pdf) {
      broadcaster.start('Generating PDF...');

      try {
        const log = readFileSync(__dirname + 'temp/log.txt', 'utf-8');
        const analysis = parseSpamAnalysis(log);
        generatePDF(analysis);
        broadcaster.succeed(`Generated PDF file at ${broadcaster.color(resolve(__dirname, 'temp/spam-analysis.pdf'), 'green')}`);
      }

      catch (error) {
        broadcaster.fail();
        broadcaster.error(error as string);
      }
    }
  }

  catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('ENOENT')) {
        broadcaster.error('ERROR: File not found! Check if the file exists in the specified path');
      }

      else {
        broadcaster.error(error.message);
      }
    }
  }
});

program.parse(process.argv);