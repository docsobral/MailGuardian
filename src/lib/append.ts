import { resolve } from 'path';
import { format } from 'prettier';
import { getFile, __dirname } from '../api/filesystem.js';

export async function getFullComponent(name: string): Promise<string> {
  const component: string = await getFile('mjml', resolve(__dirname, `components\\${name}`));
  return component;
}

export async function getSections(fullComponent: string): Promise<(string | undefined)[]> {
  const media480 = /(?<=@media *\(max-width: *480px\) *{\n)([\s\S]*?})(?=\n *}[\s\S]*<\/mj-style>)/.exec(fullComponent);
  const media280 = /(?<=@media *\(max-width: *280px\) *{\n)([\s\S]*?})(?=\n *}[\s\S]*<\/mj-style>)/.exec(fullComponent);
  const regularStyles = /(?<=<mj-style>\n)([\s\S]*)(?=\n\s*\n\s{6}@media[\w\s]*\(max-width: 4)/.exec(fullComponent);
  const body = /(?<=<mj-body.*?>\n)([\s\S]*?)(?=\n.*<\/mj-body>)/.exec(fullComponent);

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
    replacer = '\n      @media only screen and (max-width: 480px) {' + section + '}\n';
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

// const mjml = `<mjml>
//   <mj-head>
//     <mj-style>
//       
//     </mj-style>
//   </mj-head>

//   <mj-body background-color="#ffffff">

//   </mj-body>
// </mjml>`

// const parts = await getSections(await getFullComponent('rating-conecta'));
// // @ts-ignore
// const bparts = await beautifySections(parts);
// // console.log(bparts[1]);
// const ibparts = indent(bparts);
// console.log(ibparts[0])
// let finalMJML = await insertSections(ibparts[0], mjml, 'styles');
// finalMJML = await insertSections(ibparts[1], finalMJML, 'body');
// console.log(finalMJML);