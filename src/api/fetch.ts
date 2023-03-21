import { readFile } from 'node:fs/promises';
import path from 'path';

export async function getFile(type: 'html' | 'mjml', path: string): Promise<string> {
  let string = '';

  if (type === 'html') {
    string = (await readFile(path + '/index.html')).toString();
    return string;
  }

  string = (await readFile(path + '/index.mjml')).toString();
  return string;
}

export async function getImage(path: string, imageName: string): Promise<Buffer> {
  let image: Buffer = await readFile(path + `/img/${imageName}`);
  return image;
}

export const dirname = path.dirname(process.argv[1]);