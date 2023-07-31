import { resolve } from 'path';
import { format } from 'prettier';
import { getFile, __dirname } from '../api/filesystem.js';

export async function getFullComponent(name: string): Promise<string> {
  const component: string = await getFile('mjml', resolve(__dirname, `components\\${name}`));
  return component;
}

export async function getSections(fullComponent: string): Promise<[ string | undefined, string | undefined ]> {
  const style = /(?<=<mj-style>\n)([\s\S]*?)(?=\n.*<\/mj-style>)/.exec(fullComponent);
  const body = /(?<=<mj-body.*?>\n)([\s\S]*?)(?=\n.*<\/mj-body>)/.exec(fullComponent);

  return [ style?.shift(), body?.shift() ]
}

export async function beautifySections(sections: [ string, string ]): Promise<string[]> {
  let styles = sections[0];
  let body = sections[1];

  styles = await format(styles, { parser: 'css' });
  body = await format(body, { parser: 'html', singleAttributePerLine: true, bracketSameLine: true });

  return [ styles, body ];
}

export function indent(sections: string[]) {
  let styles = sections[0];
  let body = sections[1];

  styles = styles.replace(/^/gm, '      ');
  body = body.replace(/^/gm, '    ');

  return [ styles, body ];
}

export function insertSections(section: string, mjml: string, type: 'styles' | 'body'): string {
  let stylesReplacer: RegExp;

  if (type === 'styles') {
    stylesReplacer = /(?<=<mj-style>\n)([\s\S]*?)(?=\n.*<\/mj-style>)/g
  } else {
    stylesReplacer = /(?<=<mj-body.*?>\n)([\s\S]*?)(?=\n.*<\/mj-body>)/g
  }

  mjml = mjml.replace(stylesReplacer, section);

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
// let finalMJML = insertSections(ibparts[0], mjml, 'styles');
// finalMJML = insertSections(ibparts[1], finalMJML, 'body');
// console.log(finalMJML);