import { readFile } from 'node:fs/promises';

// const dirname = import.meta.url;

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