import chalk from 'chalk';
import Watch from 'node-watch';
import __dirname from '../api/dirname.js';
import { readdir, unlink, writeFile } from 'node:fs/promises';
// @ts-ignore
import selectFolder from 'win-select-folder';
import { getFile, getImage } from '../api/fetch.js';
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

export async function getMJML(path: string): Promise<string> {
  const mjml = getFile('mjml', path);

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

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export async function watch(folderPath: string, projectName: string) {
  console.log(`${chalk.yellow(`Watching MJML`)}`);

  // @ts-ignore
  Watch(folderPath + '\\index.mjml', async (evt: string, filePath: string) => {
    console.log(`${chalk.blue(`${capitalizeFirstLetter(evt)} detected at ${filePath}`)}`);

    const mjml = await getFile('mjml', folderPath);
    const filesInBucket = await listFiles(projectName);
    const mjmlExists = await fileExists('index.mjml', filesInBucket.data);

    if (!mjmlExists) {
      console.log(`${chalk.blue('Sending files to bucket')}`);
      await uploadFile(mjml, 'index.mjml', projectName);

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

    const files = await readdir(__dirname + 'temp');
    for (let file of files) {
      await unlink(__dirname + 'temp\\' + file);
    }

    try {
      await writeFile(__dirname + 'temp\\index.mjml', mjml);

      if (mjmlExists) {
        console.log(`${chalk.blue('Updating MJML')}`);
        try {
          await updateFile(mjml, 'index.mjml', projectName);
          console.log(`${chalk.blue('Success!')}`);
        }

        catch (error) {
          console.error(`${chalk.red(error)}`);
        }
      }
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
      process.exit(1);
    }
  });
}