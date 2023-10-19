import { readdir } from 'node:fs/promises';
import selectFolder from 'win-select-folder';
import { uploadFile } from '../api/supabase.js';
import { __dirname } from '../api/filesystem.js';
import { Broadcaster } from '../api/broadcaster.js';
import { getFile, getImage } from '../api/filesystem.js';

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

export async function uploadMJML(bucketName: string, path: string, type: 'normal' | 'marketo' | 'email', broadcaster: Broadcaster, emailName?: string): Promise<void> {
  try {
    let fileName: string = '';

    switch (type) {
      case 'normal':
        fileName = 'index.mjml'
        break;
      case 'marketo':
        fileName = 'marketo.mjml'
      case 'email' :
        fileName = `${emailName}/index.mjml`
    }

    broadcaster.start(`Uploading ${fileName} file...`);

    const mjml = await getMJML(path, type === 'marketo' ? true : false);
    const upload = await uploadFile(mjml, `${fileName}`, bucketName, 'text/plain');

    if (upload.error) {
      broadcaster.fail(`Failed to upload ${fileName} file!\n`)
      throw new Error(upload.error.stack);
    }

    broadcaster.succeed(`Successfully uploaded ${fileName} file!`);
  }

  catch (error) {
    broadcaster.warn(error as string);
  }
}

export async function uploadImages(bucketName: string, path: string, broadcaster: Broadcaster, emailName?: string): Promise<void> {
  const images = await getImages(path);

  broadcaster.start('Uploading images...')

  Object.keys(images).forEach(async (imageName) => {
    const upload = await uploadFile(images[imageName], emailName ? `${emailName}/img/${imageName}` : `img/${imageName}`, bucketName, 'image/png');
    if (upload.error) {
      broadcaster.append(`   Failed to upload ${imageName}! ${upload.error.message}`, 'red', true);
    }
    broadcaster.append(`   Succesfully uploaded ${imageName}`, 'blue', true);
  });

  await delay(3000);
  broadcaster.succeed();
}

async function delay(ms: number): Promise<unknown> {
  return new Promise(resolve => setTimeout(resolve, ms));
}