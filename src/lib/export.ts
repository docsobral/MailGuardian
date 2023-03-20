import { getFile, getImage } from '../api/fetch.js';
import { writeFileSync, readdirSync } from 'node:fs';

type Images = {
  [name: string]: Buffer
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

const images = await getImages('./test', await getImageNames('./test'));

Object.keys(images).forEach(name => {
  writeFileSync(`./${name}`, images[name])
});