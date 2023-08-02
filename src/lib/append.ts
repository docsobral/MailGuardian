import { resolve } from 'path';
import { format } from 'prettier';
import { getFile, __dirname } from '../api/filesystem.js';

export async function getFullComponent(name: string): Promise<string> {
  const component: string = await getFile('mjml', resolve(__dirname, `components\\${name}`));
  return component;
}

export async function getSections(fullComponent: string): Promise<[ string | undefined, string | undefined ]> {
  const media480 = /(?<=@media *\(max-width: *480px\) *{\n)([\s\S]*?})(?=\n *}[\s\S]*<\/mj-style>)/.exec(fullComponent);
  const body = /(?<=<mj-body.*?>\n)([\s\S]*?)(?=\n.*<\/mj-body>)/.exec(fullComponent);

  return [ media480 ? media480.shift() : '', body?.shift() ];
}

export async function beautifySections(sections: [ string, string ]): Promise<string[]> {
  let styles = sections[0];
  let body = sections[1];

  styles = await format(styles, { parser: 'css' });
  body = await format(body, { parser: 'html', singleAttributePerLine: true, bracketSameLine: true });

  return [ styles, body ];
}

export function indent(sections: string[]) {
  let media480 = sections[0];
  let body = sections[1];

  media480 = media480 === '' ? '' : media480.replace(/^/gm, ' '.repeat(8));
  body = body.replace(/^/gm, ' '.repeat(4));

  return [ media480, body ];
}

export async function insertSections(section: string, mjml: string, type: 'media480' | 'body', name?: string): Promise<string> {
  let replacer: RegExp;

  if (type === 'media480') {
    replacer = /(\s*)<\/mj-style>/g;
    mjml = mjml.replace(replacer, '\n' + section + '<\/mj-style>');
    replacer = /  (?=<\/mj-style>)/;
    mjml = mjml.replace(replacer, '');
    replacer = / {6}(?=\n)/g;
    mjml = mjml.replace(replacer, '');
  } else {
    replacer = /(\s*)<\/mj-body>/g
    mjml = await format(
      mjml.replace(replacer, `\n\n<!--START ${name?.toUpperCase()}-->\n\n` + section + `\n<!--END ${name?.toUpperCase()}-->\n\n<\/mj-body>`),
      { parser: 'html', singleAttributePerLine: true, bracketSameLine: true }
    );
  }

  return mjml;
}

// const mjml = `<mjml>
//   <mj-head>
//     <mj-style>
//       @media(max-width: 480px) {

//       }
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