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
import { resolve } from 'node:path';
import { watchFile } from 'node:fs';
import { AuthError } from '@supabase/supabase-js';
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
  // watch,
  uploadMJML,
  uploadImages,
  // getMJML,
  // getImages
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
  // getSession,
  // saveSession,
} from '../api/filesystem.js';

import {
  compileHTML,
  CompilerOptions,
} from '../lib/build.js';

// import {
//   MJML,
// } from '../types/mjml.types.js';

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
.action(async (
  name: string, path: string, options: { watch: boolean, newPath: boolean, marketo: boolean, clean: boolean, images: boolean}) => {
  try {
    const supabaseAPI = await import('../api/supabase.js');

    // const session = getSession();
    // const [newSession, refreshed] = await supabaseAPI.refreshSession(session);

    // if (refreshed) {
    //   saveSession(newSession);
    // }

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
    console.error(`${chalk.red(error)}`);
  }
});

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// program
// .command('bucket')
// .description('Lists, creates or deletes buckets')
// .argument('[name]', 'Name of the bucket')
// .option('-c, --create', 'creates a bucket', false)
// .option('-d, --delete', 'deletes a bucket', false)
// .option('-l, --list', 'lists buckets', false)
// .action(async (name: string, options: {create: boolean, delete: boolean, list: boolean}) => {
//   try {
//     const supabaseAPI = await import('../api/supabase.js');

//     const session = getSession();
//     const [newSession, refreshed] = await supabaseAPI.refreshSession(session);
//     if (refreshed) {
//       saveSession(newSession);
//     }

//     const result = await supabaseAPI.manageDBBucket(name, options, broadcaster);
//     await delay(1000);

//     broadcaster.succeed();

//     if (typeof result !== 'undefined') {
//       async function broadcastList() {
//         process.stdout.write('\n');
//         const spinner = ora(`${chalk.yellow('Fetching templates...')}`).start();
//         const list: string[] = await supabaseAPI.listAllBuckets();

//         await delay(1000);

//         if (list.length === 0) {
//           spinner.fail(`${chalk.red('There are no buckets in the server. Use \'mailer bucket [name] -c\' to create one.')}`);
//           return;
//         }

//         spinner.succeed(`${chalk.yellow('Templates:')}`);
//         let count = 1;
//         for (let index in list) {
//           console.log(`  ${chalk.yellow(`${count}.`)} ${chalk.blue(list[index])}`);
//           count++
//         }
//       }

//       await broadcastList();
//     }
//   }

//   catch (error) {

//   }
// });

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

    // const session = getSession();
    // const [newSession, refreshed] = await supabaseAPI.refreshSession(session);

    // if (refreshed) {
    //   saveSession(newSession);
    // }

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
    console.log(`${chalk.red(error)}`);
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
      console.log(`${chalk.yellow(`\nCreated component named ${name} at ${__dirname}\\components\\${name}. Opening in new VSCode window...`)}`);
      await delay(1000);

      openVS(name, 'component');

      return;
    }

    if (options. delete) {
      await manageTemplate(name, true, 'component');
      console.log(`${chalk.yellow(`\nDeleted component named ${name}.`)}`);
    }
  }

  catch (error: any) {
    console.error(`${chalk.red(error)}`);
  }
});

// program
// .command('login')
// .description('Logs in to supabase')
// .argument('<email>', 'User ID')
// .argument('<password>', 'Passowrd')
// .action(async (email: string, password: string) => {
//   try {
//     const supabaseAPI = (await import('../api/supabase.js'));

//     broadcaster.start(chalk.yellow('Logging you in...'));
//     const session = await supabaseAPI.logIn(email, password);
//     broadcaster.succeed();

//     if (session) {
//       saveSession(session);
//     }
//   }

//   catch (error) {
//     broadcaster.fail();
//     throw error;
//   }
// });

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
      spinner.suffixText = chalk.blueBright(`\n  Change detected at ${hours}`);
      const [result, error] = await compileHTML(compilerOptions);

      if (result === 'error') {
        spinner.fail(error);
      }

      setTimeout(() => {
        waiting = false;
      }, 5000);
    });

    watcher.once('start', async () => {
      const [result, error] = await compileHTML(compilerOptions);

      if (result === 'error') {
        spinner.fail(error);
      }

      spinner.text = `${chalk.yellow(`Now watching file: ${resolve(folderPath, fileName)}`)}`;
      waiting = false;
    });

    process.stdout.write('\n');
    const spinner = ora(`${chalk.white(`Starting watcher...`)}`).start();
    await delay(1000);

    watcher.emit('start');

    process.on('SIGINT', () => {
      spinner.suffixText = spinner.suffixText + chalk.red('\n  Stopping the watcher...')
      spinner.succeed();
      watcher.removeAllListeners();
      process.exit(0);
    });
    return;
  }

  const [result, error, pathToHTML] = await compileHTML(compilerOptions);
  process.stdout.write('\n');
  const spinner = ora(`${chalk.yellow('Compiling HTML...')}`).start();
  await delay(500);

  if (result === 'error') {
    spinner.fail(error);
  } else {
    spinner.succeed(`Parsed MJML and saved HTML at ${pathToHTML}\n`);
  }
});

// program.command('export-template')
// .description('Exports a template to the server')
// .argument('<name>', 'Name of the bucket to where the template should be exported')
// .argument('[path]', 'Path to the folder where the template is located', resolve())
// .option('-n, --name <name>', 'Name of the MJML file (e.g. \'index.mjml\'', 'index')
// .option('-m, --marketo', 'Specifies that the MJML is destined for Marketo', false)
// .action(async (name: string, path: string, options: {name: string, marketo: boolean}) => {
//   try {
//     const supabaseAPI = (await import('../api/supabase.js'));
//     const session = getSession();
//     const [newSession] = await supabaseAPI.refreshSession(session);
//     saveSession(newSession);

//     options.name = options.name.replace(/.mjml/, '');

//     broadcaster.start(chalk.yellow('Fetching local MJML file...'));
//     await delay(1000);

//     const localMJMLOBJ: MJML = {
//       marketo: options.marketo,
//       markup: await getMJML(path, options.marketo),
//     }

//     const remoteFiles = await supabaseAPI.getBucket(name);

//     const remoteMJML = remoteFiles.mjml;
//     let MJMLObject: any;

//     if (typeof remoteMJML === 'string') {
//       MJMLObject = JSON.parse(remoteMJML);
//     } else {
//       MJMLObject = remoteMJML;
//     }

//     MJMLObject[options.name] = localMJMLOBJ;
//     const MJMLJSONString = JSON.stringify(MJMLObject, null, 2);

//     broadcaster.text = chalk.yellow('Fetching images...')
//     await delay(1000);

//     const remoteIMG: any = remoteFiles.img;
//     const images = await getImages(path);
//     let IMGObject: any;

//     if (typeof IMGObject === 'string') {
//       IMGObject = JSON.parse(remoteIMG);
//     } else {
//       IMGObject = remoteIMG;
//     }


//     Object.keys(images).forEach(image => {
//       IMGObject[image] = images[image].toJSON();
//     });

//     const IMGJSONString = JSON.stringify(IMGObject, null, 2);

//     broadcaster.text = chalk.yellow('Updating remote files...');
//     await delay(1000);
//     await supabaseAPI.updateBucket(name, { mjml: MJMLJSONString, img: IMGJSONString });
//     broadcaster.succeed(chalk.yellow('Finished exporting MJML.'));
//   }

//   catch (error) {
//     broadcaster.fail();
//     throw error;
//   }
// });

program
.command('prepare')
.description('Parses MJML file into HTML according to provided parameters')
.argument('<name>', 'Name of the bucket where the MJML you want to parse is located')
.option('-m, --marketo', 'parses MJML for Marketo', false)
.action(async (name: string, options: {marketo: boolean}) => {
  try {
    const supabaseAPI = await import('../api/supabase.js');

    // const session = getSession();
    // const [newSession, refreshed] = await supabaseAPI.refreshSession(session);

    // if (refreshed) {
    //   saveSession(newSession);
    // }

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
          spinner.fail();
          throw new Error(`Failed to delete ${options.marketo? 'marketo.html' : 'index.html'} file! ${result.error.stack?.slice(17)}`);
        }
      }

      const results = await supabaseAPI.uploadFile(readFileSync(resolve(__tempdirname, 'parsed.html'), { encoding: 'utf8' }), `${options.marketo? 'marketo.html' : 'index.html'}`, name);

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
.command('send')
.description('Mails a HTML file to a recipient list')
.argument('<name>', 'Name of the bucket where the template is located')
.argument('<recipients>', 'Recipient list (e.g. "davidsobral@me.com, davidcsobral@gmail.com"')
.option('-m, --marketo', 'sends the Marketo compatible HTML', false)
.action(async (name: string, recipientsString: string, options: { marketo: boolean }) => {
  try {
    const supabaseAPI = await import('../api/supabase.js');

    // const session = getSession();
    // const [newSession, refreshed] = await supabaseAPI.refreshSession(session);

    // if (refreshed) {
    //   saveSession(newSession);
    // }

    const check: boolean = await isLoggedIn();
    if (!check) {
      process.stdout.write('\n');
      throw new AuthError(`${chalk.red('Please enter valid email credentials with \'mailer save-credentials\' before trying to send an email')}`);
    }

    const bucket = await supabaseAPI.bucketExists(name);
    if (bucket.error) {
      process.stdout.write('\n');
      throw new BucketError('Bucket doesn\'t exist! Use \'mailer bucket -c <name>\' to create one before trying to export a template.');
    }

    const recipientsList = recipientsString.split(/ *, */);

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

      catch (error: any) {
        spinner.fail();
        console.error(error);
      }
    }
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
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
    console.error(`${chalk.red(error)}`);
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
    process.stdout.write('\n');
    const spinner = ora(`${chalk.yellow('Saving config...')}`).start();
    save('config', (key as keyof typeof Config).toUpperCase(), options[key as keyof typeof Config]);
    await delay(1000);
    spinner.succeed(`Saved ${chalk.green(key)} as ${chalk.green(options[key as keyof typeof Config])}`);
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
  }
});

program
.command('import')
.description('Fetch all files from a template bucket (including the .html file')
.argument('<name>', 'The bucket\'s name')
.action(async (name: string) => {
  const supabaseAPI = await import('../api/supabase.js');

  // const session = getSession();
  // const [newSession, refreshed] = await supabaseAPI.refreshSession(session);

  // if (refreshed) {
  //   saveSession(newSession);
  // }

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

    spinner.succeed(`Imported files from ${chalk.green(name)} bucket to ${chalk.green(__importdirname)}`);
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
      process.stdout.write('\n');
      const spinner = ora(`${chalk.yellow('Generating PDF...')}`).start();

      try {
        const log = readFileSync(__dirname + 'temp/log.txt', 'utf-8');
        const analysis = parseSpamAnalysis(log);
        generatePDF(analysis);
        spinner.succeed(`Generated PDF file at ${chalk.green(resolve(__dirname, 'temp/spam-analysis.pdf'))}`);
      }

      catch (error) {
        spinner.fail();
        console.error(`${chalk.red(error)}`);
      }
    }
  }

  catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('ENOENT')) {
        console.error(`${chalk.red('ERROR: File not found! Try running \'mailer prepare\' first.')}`);
      }

      else {
        console.error(`${chalk.red(error.message)}`);
      }
    }
  }
});

program.parse(process.argv);