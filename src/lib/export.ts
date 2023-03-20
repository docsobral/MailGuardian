import { getFile, getImage } from '../api/fetch.js';
import { writeFileSync, readdirSync } from 'node:fs';
// @ts-ignore
import selectFolder from 'win-select-folder';

type Images = {
  [name: string]: Buffer
}

type FolderSelectOptions = {
  root: string;
  description: string;
  newFolder: number;
}

async function getPath(): Promise<string> {
  const options: FolderSelectOptions = {
    root: 'Desktop',
    description: 'Find the project folder:',
    newFolder: 0,
  }

  return await selectFolder(options);
}

async function getMJML(path: string): Promise<string> {
  const mjml = getFile('mjml', path);

  return mjml;
}

async function getImageNames(path: string): Promise<string[]> {
  let list: string[] = [];

  list = readdirSync(path + '/img');

  return list;
}

async function getImages(path: string, list: string[]): Promise<Images> {
  let images: Images = {};

  for (let image of list) {
    images[image] = await getImage(path, image);
  }

  return images;
}

const path = await getPath();
const images = await getImages(path, await getImageNames(path));

Object.keys(images).forEach(name => {
  writeFileSync(`./${name}`, images[name])
});