import { resolve } from 'path';
import { format } from 'prettier';
import { getImages } from './export.js';
import { BucketError } from './error.js';
import { broadcaster } from '../bin/index.js';
import { listBuckets } from '../api/supabase.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { getFile, __dirname } from '../api/filesystem.js';

export async function getFullComponent(name: string): Promise<string> {
  const component: string = await getFile('mjml', resolve(__dirname, `components\\${name}`));
  return component;
}

export async function getSections(fullComponent: string): Promise<(string | undefined)[]> {
  const media480 = /(?<=@media *\(max-width: *480px\) *{\n)([\s\S]*?})(?=\n *}[\s\S]*<\/mj-style>)/.exec(fullComponent);
  const media280 = /(?<=@media *\(max-width: *280px\) *{\n)([\s\S]*?})(?=\n *}[\s\S]*<\/mj-style>)/.exec(fullComponent);
  const regularStyles = /(?<=<mj-style>\n)([\s\S]*)(?=\n\s*\n\s{6}@media[\w\s]*\(max-width: 4)/.exec(fullComponent);
  const body = /(?<=<mj-body[\s\S]*?>\n)([\s\S]*?)(?=\n.*<\/mj-body>)/.exec(fullComponent);

  return [
    media480 ? media480.shift() : '',
    body?.shift(),
    media280 ? media280.shift() : '',
    regularStyles ? regularStyles.shift() : ''
  ];
}

export async function beautifySections(sections: string[]): Promise<string[]> {
  let media480 = sections[0];
  let body = sections[1];
  let media280 = sections[2];
  let regularStyles = sections[3];

  media480 = await format(media480, { parser: 'css' });
  body = await format(body, { parser: 'html', singleAttributePerLine: true, bracketSameLine: true });
  media280 = await format(media280, { parser: 'css' });
  regularStyles = await format(regularStyles, { parser: 'css' });

  return [ media480, body, media280, regularStyles ];
}

export function indent(sections: string[]) {
  let media480 = sections[0];
  let body = sections[1];
  let media280 = sections[2];
  let regularStyles = sections[3];

  media480 = media480 === '' ? '' : media480.replace(/^/gm, ' '.repeat(8));
  body = body.replace(/^/gm, ' '.repeat(4));
  media280 = media280 === '' ? '' : media280.replace(/^/gm, ' '.repeat(8));
  regularStyles = regularStyles === '' ? '' : regularStyles.replace(/^/gm, ' '.repeat(6));

  return [ media480, body, media280, regularStyles ];
}

export async function insertSections(
  section: string,
  mjml: string,
  type: 'media480' | 'body' | 'media280' | 'regularStyles',
  name?: string): Promise<string> {

  let finder: RegExp;
  let replacer: string;

  if (type === 'media480') {
    finder = /( *)(?=<\/mj-style>)/;
    replacer = '\n      @media only screen and (max-width: 480px) {\n' + section + '}\n';
    mjml = mjml.replace(finder, replacer);

    finder = /  }\n<\/mj-style>/;
    replacer = '}\n    </mj-style>';
    mjml = mjml.replace(finder, replacer);

    finder = /^ {8}(?=\n)/gm;
    mjml = mjml.replace(finder, '');
  }

  else if (type === 'media280') {
    finder = /( *)(?=<\/mj-style>)/;
    replacer = '\n      @media only screen and (max-width: 280px) {\n' + section + '}\n'
    mjml = mjml.replace(finder, replacer);

    finder = /  }\n<\/mj-style>/;
    replacer = '}\n    </mj-style>';
    mjml = mjml.replace(finder, replacer);

    finder = /^ {8}(?=\n)/gm;
    mjml = mjml.replace(finder, '');
  }

  else if (type === 'regularStyles') {
    finder = /(?<=<mj-style>)(\n)/
    replacer = '\n' + section + '\n'
    mjml = mjml.replace(finder, replacer);

    finder = /^ {6}(?=\n)/gm;
    mjml = mjml.replace(finder, '');
  }

  else {
    finder = /(\s*)<\/mj-body>/g
    mjml = await format(
      mjml.replace(finder, `\n\n<!--START ${name?.toUpperCase()}-->\n\n` + section + `\n<!--END ${name?.toUpperCase()}-->\n\n<\/mj-body>`),
      { parser: 'html', singleAttributePerLine: true, bracketSameLine: true }
    );
  }

  return mjml;
}

export async function listComponents(): Promise<void> {
  broadcaster.start('Fetching templates...');
  const { data, error } = await listBuckets();

  if (error) {
    broadcaster.fail();
    throw new BucketError(`\nFailed to fetch templates!\n\n${error.stack?.slice(17)}`);
  }

  if (data.length === 0) {
    broadcaster.fail('There are no templates in the server. Use \'mailer template -c [name]\' to create one.');

    return;
  }

  broadcaster.succeed('Templates:');
  let count = 1;
  for (let index in data) {
    broadcaster.logSeries([[`  ${count}.`, 'yellow'], [` ${data[index].name}`, 'blue']]);
    count++
  }
}

function splitComponents(components: string): string[] {
  return components.split(',').map(component => component.trim());
}

export async function importComponents(commandParameter: string, name: string): Promise<void> {
  try {
    broadcaster.start('Importing components to new template...');
    const components: string[] = splitComponents(commandParameter);
    let mjml = readFileSync(resolve(__dirname, `templates\\${name}\\index.mjml`), { encoding: 'utf8' });

    let media480: string = '';
    let media280: string = '';
    let regularStyles: string = '';

    for (const i in components) {
      const parts = await getSections(await getFullComponent(components[i]));
      // @ts-ignore
      const beautified = await beautifySections(parts);
      const indented = indent(beautified);

      mjml = await insertSections(indented[1], mjml, 'body', components[i]);
      media480 += indented[0];
      media280 += indented[2];
      regularStyles += indented[3];

      if (Number(i) < (components.length - 1)) {
        media480 += '\n';
      }

      const images = await getImages(resolve(__dirname, `components\\${components[i]}`));
      Object.keys(images).forEach(imageName => {
        writeFileSync(resolve(__dirname, `templates\\${name}\\img\\${imageName}`), images[imageName]);
      });
    }

    mjml = await insertSections(media480, mjml, 'media480');

    if (media280 !== '') {
      mjml = await insertSections(media280, mjml, 'media280');
    }

    if (regularStyles !== '') {
      mjml = await insertSections(regularStyles, mjml, 'regularStyles');
    }

    writeFileSync(resolve(__dirname, `templates\\${name}\\index.mjml`), mjml);
  }

  catch (error) {
    broadcaster.fail();
    broadcaster.warn(error as string);
  }
}