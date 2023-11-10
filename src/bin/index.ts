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
import { mailHTML } from '../lib/mail.js';
import { getPath } from '../lib/export.js';
import { Broadcaster } from '../api/broadcaster.js';
import { writeFileSync, readFileSync } from 'node:fs';
import { compileHTML, CompilerOptions, } from '../lib/build.js';
import { __dirname, getFile, getVersion, } from '../api/filesystem.js';

export const broadcaster = new Broadcaster();

program.version(getVersion());

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

program
.command('replace-src')
.description('Replaces img tags\' src attributes with a remote url')
.argument('[path]', 'Path to the folder where the HTML file is located', resolve())
.option('-b, --bucket <bucket>', 'Specify the name of the bucket where the img files are located')
.option('-n, --name <name>', 'Specify the name of the HTML file (e.g.: \'filename.html\')', 'index.html')
.action(async (path: string, options: {bucket: string | undefined, name: string}) => {
  if (!options.bucket) {
    broadcaster.error('You must specify the bucket\'s name');
    process.exit(1);
  }

  const supabaseAPI = await import('../api/supabase.js');

  let imgList: string[] = [];
  let signedUrlList: string[] = [];

  const imageList = await supabaseAPI.listImages(options.bucket);

  if (imageList.error) {
    broadcaster.fail();
    broadcaster.error(`Failed to fetch list of image names! ${imageList.error.stack?.slice(17)}`);
  }

  // @ts-ignore
  imageList.data.forEach(fileObject => imgList.push(fileObject.name));
  const signedList = await supabaseAPI.imagesUrls(options.bucket, imgList);

  if (signedList.error) {
    broadcaster.fail();
    broadcaster.error(`Failed to get signed URLs! ${signedList.error.stack?.slice(17)}`);
  }

  // @ts-ignore
  signedList.data.forEach(object => signedUrlList.push(object.signedUrl));

  let htmlString: string = '';

  try {
    htmlString = readFileSync(resolve(path, options.name), { encoding: 'utf8' });
  }

  catch (error) {
    broadcaster.fail();
    broadcaster.error(`Failed to get the HTML file!\n${error}`);
  }

  // MOVE THIS FUNCTION TO A SEPARATE FILE
  // replace local paths for remote paths
  for (let index in imgList) {
    const localPath = `(?<=src=")(.*)(${imgList[index]})(?=")`;
    const replacer = new RegExp(localPath, 'g');
    htmlString = htmlString.replace(replacer, signedUrlList[index]);
  };

  writeFileSync(resolve(path, options.name), htmlString, { encoding: 'utf8' });
})

program
.command('build')
.description('Compiles MJML into HTML')
.argument('[path]', 'Path to the folder where the MJML file is located', resolve())
.option('-n, --name <name>', 'Specifies the name of the MJML file (e.g.: \'filename.mjml\')', 'index.mjml')
.option('-a, --author [taskCode]', 'Inserts Author meta tag into HTML', '')
.option('-i, --if', 'Inserts IF block', false)
.option('-w, --watch', 'Compiles file after every change', false)
.option('-l, --labels', 'Inserts labels in the final HTML', false)
.option('-m, --minify', 'Minified the output HTML', false)
.action(async (path: string, options: {name: string, author: string, if: boolean, watch: boolean, labels: boolean, minify: boolean}) => {
  const compilerOptions: CompilerOptions = {
    folderPath: path,
    fileName: options.name.replace(/.mjml/, ''),
    insertAuthor: options.author ? true : false,
    taskCode: typeof options.author === 'boolean' ? '' : options.author,
    insertIF: options.if,
    watch: options.watch,
    insertLabels: options.labels,
    minify: options.minify,
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
      const [result, error] = await compileHTML(compilerOptions, broadcaster);

      if (result === 'error') {
        broadcaster.fail(error);
      }

      setTimeout(() => {
        waiting = false;
      }, 5000);
    });

    watcher.once('start', async () => {
      const [result, error] = await compileHTML(compilerOptions, broadcaster);

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

  const [result, error, pathToHTML] = await compileHTML(compilerOptions, broadcaster);
  broadcaster.start('Compiling HTML...');
  await delay(500);

  if (result === 'error') {
    broadcaster.fail(error);
  } else {
    broadcaster.succeed(`Parsed MJML and saved HTML at ${pathToHTML}\n`);
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

program.parse(process.argv);