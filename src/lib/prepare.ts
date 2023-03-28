import chalk from 'chalk';
import mjml2html from 'mjml';
import __dirname from '../api/dirname.js';
import { downloadFile } from '../api/supabase.js';
// import { readFileSync, writeFileSync } from 'node:fs';
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
  const html = beautifyHTML(htmlObject.html);

  if (marketo) {
    const parsedHTML =  divToTable(html);
    return parsedHTML
  }

  return html;
}

function beautifyHTML(html: string) {
  let beautifiedHTML = html_beautify(html, beautifyOptions);
  return beautifiedHTML;
}

export function divToTable(html: string) {
  let string = html;
  let replacer: RegExp;
  let matcher: RegExp;
  let matches: IterableIterator<RegExpMatchArray>;
  let sectionClasses: string[] = [];
  let imgTags: string[] = [];

  // mktoname & id generator
  let count = 0;
  function generator() {
    count++
    return `a${count}`
  }

  // get classes from sections
  const divClass = /(?<= *<div class=")(?!mj)(.+)(?=" style)/g;
  matcher = new RegExp(divClass);
  matches = string.matchAll(matcher);
  for (let match of matches) {
    sectionClasses.push(match[1]);
  }

  const topSectionClass = sectionClasses[0];
  const nextSectionClasses = sectionClasses.splice(1);

  // get img tags
  const imgTag = /(?<!<div.*>\n.*)(<img.*\/>)/;
  matcher = new RegExp(imgTag, 'g');
  matches = string.matchAll(matcher);
  for (let match of matches) {
    imgTags.push(match[1]);
  }

  // first <div> to <table><tbody><tr><td>
  const firstDivReg = /(<div)(.*)(>)(?=\n *<!)/;
  replacer = new RegExp(firstDivReg);
  string = string.replace(replacer, '<table class="mj-full-width-mobile" align="center"><tbody><tr><td class="mktoContainer" id="container" width="600" style="width: 600px;">');

  // end </div> to </td></tr></tbody></table>
  const endDivReg = /(<\/div>)(?=\n.*<\/body>)/;
  replacer = new RegExp(endDivReg, 'g');
  string = string.replace(replacer, '</td></tr></tbody></table>');

  // middle second div + ghost table opening (closing div)
  const middleDivGhost = /( *)(<\/div>)(\n)(      )(<!--)(.*)(\n)(.*)(<div class.*)(600px;">\n *)(<table align="center")/;
  replacer = new RegExp(middleDivGhost);
  while (nextSectionClasses.length > 0) string = string.replace(replacer, `<table align="center" class="mktoModule mj-full-width-mobile ${nextSectionClasses.shift()}" mktoname="${generator()}" id="${generator()}"`);

  // top div + ghost table opening
  const topDivGhost = /(<!--)(.*)(\n)(.*)(max-width:600px;">\n *)(<table align="center")/;
  replacer = new RegExp(topDivGhost);
  string = string.replace(replacer, `<table align="center" class="mktoModule mj-full-width-mobile ${topSectionClass}" mktoname="${generator()}" id="${generator()}"`);

  // beautify
  string = beautifyHTML(string);

  // end div + ghost table opening
  const endDivGhost = /(<\/div>\n)( *<!.*\n)(?=.*\n.*\n.*\n.*\n.*<\/body>)/;
  replacer = new RegExp(endDivGhost, 'g');
  string = string.replace(replacer, '');

  // surround img tags with divs
  replacer = new RegExp(imgTag);
  while (imgTags.length > 0) string = string.replace(imgTag, `<div class="mktoImg" mktoname="${generator()}" id="${generator()}">\n${imgTags.shift()}</div>`);

  // beautify
  string = beautifyHTML(string);

  return string;
}