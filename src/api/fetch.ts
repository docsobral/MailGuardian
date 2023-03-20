import { readFile } from 'node:fs/promises';

export async function getFile(type: 'html' | 'mjml' | 'png', path: string): Promise<string> {
  let string = '';

  if (type === 'html') {
    string = (await readFile(path)).toString();
    return string;
  }

  if (type === 'mjml') {
    return string;
  }

  return string;
}