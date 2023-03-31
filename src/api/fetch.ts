import { readFile } from 'node:fs/promises';
import chalk from 'chalk';
import path from 'path';

export async function getFile(type: 'html' | 'mjml', path: string, marketo: boolean = false): Promise<string> {
  let string: any;

  if (type === 'html') {
    try {
      string = await readFile(path + '\\index.html');
      return string.toString();
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
      process.exit(1);
    }
  }

  try {
    const name = marketo ? 'marketo' : 'index';
    string = (await readFile(path + `\\${name}.mjml`)).toString();
    return string.toString();
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
    process.exit(1);
  }
}

export async function getImage(path: string, imageName: string): Promise<Buffer> {
  let image: Buffer;
  try {
    image = await readFile(path + `\\img\\${imageName}`);
    return image;
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
    process.exit(1);
  }
}

export const dirname = path.dirname(process.argv[1]);