import chalk from 'chalk';
import mjml2html from 'mjml';
import __dirname from '../api/dirname.js';
import { downloadFile } from '../api/supabase.js';
import { MJMLParseResults } from 'mjml-core/index.js';
import { readFileSync, writeFileSync } from 'node:fs';
import beautify, { HTMLBeautifyOptions } from 'js-beautify';

const { html_beautify } = beautify
const beautifyOptions: HTMLBeautifyOptions = {
  indent_inner_html: true,
  indent_size: 2,
  indent_char: ' ',
  max_preserve_newlines: -1,
  preserve_newlines: false,
  indent_scripts: 'normal',
  end_with_newline: false,
  wrap_line_length: 0,
  indent_empty_lines: false
}

export async function downloadMJML(projectName: string) {
  try {
    const { data, error } = await downloadFile(projectName, 'mjml');
    if (error) {
      throw new Error('Failed to get MJML file! Check the project name or the project bucket');
    }
    return data
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
    process.exit(1);
  }
}

export type MJMLBuffer = Buffer;

export function parseMJML(mjml: string, marketo?: boolean) {
  const string = mjml;
  const htmlObject = mjml2html(string);
  const html = beautifyHTML(htmlObject);

  if (marketo) {
    const parsedHTML =  divToTable(html);
    return parsedHTML
  }

  return html;
}

function beautifyHTML(htmlObject: MJMLParseResults) {
  let html = html_beautify(htmlObject.html, beautifyOptions);
  return html;
}

export function divToTable(html: string) {
  let string = html;
  let replacer: RegExp;

  // first <div> to <table><tbody><tr><td>
  const firstDivReg = /(<div)(.*)(>)(?=\n *<!)/;
  replacer = new RegExp(firstDivReg, 'g');
  string = string.replace(replacer, '<table class="mj-full-width-mobile" align="center"><tbody><tr><td class="mktoContainer" id="container" width="600" style="width: 600px;">');

  // // end </div> to </td></tr></tbody></table>
  const endDivReg = /(<\/div>\n)( *)(?=<\/body>)/;
  replacer = new RegExp(endDivReg, 'g');
  string = string.replace(replacer, '</td></tr></tbody></table>\n  ')

  return string;
}