import ora from 'ora';
import chalk from 'chalk';
import Watch from 'node-watch';
import { readdir } from 'node:fs/promises';
// @ts-ignore
import selectFolder from 'win-select-folder';
import { __dirname } from '../api/filesystem.js';
import * as supabaseAPI from '../api/supabase.js';
import { getFile, getImage } from '../api/filesystem.js';
import { fileExists, listFiles, updateFile, uploadFile } from '../api/supabase.js';

type Images = {
  [name: string]: Buffer
}

type FolderSelectOptions = {
  root: string;
  description: string;
  newFolder: number;
}

export async function getPath(): Promise<string> {
  const options: FolderSelectOptions = {
    root: 'Desktop',
    description: 'Find the project folder:',
    newFolder: 0,
  }

  return await selectFolder(options);
}

export async function getMJML(path: string, marketo: boolean = false): Promise<string> {
  const mjml = getFile('mjml', path, marketo);

  return mjml;
}

export async function getImageNames(path: string): Promise<string[]> {
  let list: string[] = [];

  list = await readdir(path + '\\img');

  return list;
}

export async function getImages(path: string): Promise<Images> {
  let images: Images = {};
  const list = await getImageNames(path);

  for (let image of list) {
    images[image] = await getImage(path, image);
  }

  return images;
}

function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export async function watch(folderPath: string, projectName: string, marketo: boolean = false): Promise<void> {
  const mjml = await getFile('mjml', folderPath, marketo);
  const filesInBucket = await listFiles(projectName);
  const fileName = marketo ? 'marketo.mjml' : 'index.mjml';
  const mjmlExists = await fileExists(fileName, filesInBucket.data);
  const type = marketo ? 'marketo' : 'index';

  if (!mjmlExists) {
    try {
      console.log(`${chalk.blue('Sending files to bucket')}`);
      const upload = await uploadFile(mjml, `${type}.mjml`, projectName);
      console.log(`${chalk.blue(`Successfully uploaded ${type}.mjml`)}`);
      if (upload.error) {
        throw new Error(`Failed to upload MJML!! ${upload.error.message}`);
      }
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
    }

    const images = await getImages(folderPath);

    Object.keys(images).forEach(async (imageName) => {
      try {
        const upload = await uploadFile(images[imageName], `img/${imageName}`, projectName, 'image/png');
        if (upload.error) {
          throw new Error(`Failed to upload ${imageName}! ${upload.error.message}`);
        }
        console.log(`${chalk.blue('Succesfully uploaded', imageName)}`);
      }

      catch (error) {
        console.error(`${chalk.red(error)}`);
      }
    });
  }

  console.log(`${chalk.yellow(`Watching MJML for changes\n`)}`);

  // @ts-ignore
  Watch(folderPath + `\\${type}.mjml`, async (evt: string, filePath: string) => {
    console.log(`${chalk.yellow(`${capitalizeFirstLetter(evt)} detected at ${filePath}`)}`);
    const newMJML = await getFile('mjml', folderPath, marketo);

    try {
      console.log(`${chalk.blue('Updating MJML')}`);
      await updateFile(newMJML, `${type}.mjml`, projectName);
      console.log(`${chalk.blue('Success!\n')}`);
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
      process.exit(1);
    }
  });
}

export async function uploadMJML(bucketName: string, path: string, marketo: boolean = false): Promise<void> {
  try {
    process.stdout.write('\n');
    const spinner = ora(`${chalk.green(`Uploading ${marketo ? 'Marketo MJML' : 'MJML'} file...`)}`).start();
    const mjml = await getMJML(path, marketo);

    const upload = await supabaseAPI.uploadFile(mjml, `${marketo ? 'marketo' : 'index'}.mjml`, bucketName, 'text/plain');
    if (upload.error) {
      spinner.fail();
      throw new Error(`Failed to upload ${marketo ? 'Marketo MJML' : 'MJML'} file!`);
    }

    spinner.succeed();
  }

  catch (error) {
    console.warn(`${chalk.red(error)}`);
  }
}

export async function uploadImages(bucketName: string, path: string): Promise<void> {
  const images = await getImages(path);

  process.stdout.write('\n');
  const spinner = ora(`${chalk.green('Uploading images...')}`).start();

  Object.keys(images).forEach(async (imageName) => {
    const upload = await supabaseAPI.uploadFile(images[imageName], `img/${imageName}`, bucketName, 'image/png');
    if (upload.error) {
      spinner.text = `${spinner.text}\n${chalk.red(`  Failed to upload ${imageName}! ${upload.error.message}`)}`;
    }
    spinner.text = `${spinner.text}\n${chalk.blue('  Succesfully uploaded', imageName)}`;
  });

  await delay(1000);
  spinner.succeed();
}

async function delay(ms: number): Promise<unknown> {
  return new Promise(resolve => setTimeout(resolve, ms));
}