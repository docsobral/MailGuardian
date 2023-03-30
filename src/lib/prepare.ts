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
  const htmlObject = mjml2html(string, { validationLevel: 'soft' });
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

  // mktoname & id generator
  let count = 0;
  function generator() {
    count++
    return `a${count}`
  }

  // get classes from sections
  let sectionClasses: string[] = [];
  const divClass = /(?<=^      <div class=")(?!mj)(.+)(?=" style)/gm;
  matcher = new RegExp(divClass);
  matches = string.matchAll(matcher);
  for (let match of matches) {
    sectionClasses.push(match[1]);
  }

  const topSectionClass = sectionClasses[0];
  const nextSectionClasses = sectionClasses.splice(1);

  // get img tags
  let imgTags: string[] = [];
  const imgTag = /(?<!<div.*>\n.*)(<img.*\/>)/;
  matcher = new RegExp(imgTag, 'g');
  matches = string.matchAll(matcher);
  for (let match of matches) {
    imgTags.push(match[1]);
  }

  // get text divs
  let textDivs: string[] = [];
  const textDiv = /(?<=<td.*\n.*)(<div style="font-family)/
  matcher = new RegExp(textDiv, 'g');
  matches = string.matchAll(matcher);
  for (let match of matches) {
    textDivs.push(match[1]);
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
  while (nextSectionClasses.length > 0) {
    const sectionClass = nextSectionClasses.shift();
    string = string.replace(replacer, `<table align="center" class="mktoModule mj-full-width-mobile ${sectionClass}" mktoname="${sectionClass}" id="${generator()}"`);
  }

  // top div + ghost table opening
  const topDivGhost = /(<!--)(.*)(\n)(.*)(max-width:600px;">\n *)(<table align="center")/;
  replacer = new RegExp(topDivGhost);
  string = string.replace(replacer, `<table align="center" class="mktoModule mj-full-width-mobile ${topSectionClass}" mktoname="${topSectionClass}" id="${generator()}"`);

  // beautify
  string = beautifyHTML(string);

  // end div + ghost table opening
  const endDivGhost = /(<\/div>\n)( *<!.*\n)(?=.*\n.*\n.*\n.*\n.*<\/body>)/;
  replacer = new RegExp(endDivGhost, 'g');
  string = string.replace(replacer, '');

  // surround img tags with divs
  replacer = new RegExp(imgTag);
  while (imgTags.length > 0) string = string.replace(imgTag, `<div class="mktoImg" mktoname="${generator()}" id="${generator()}">\n${imgTags.shift()}</div>`);

  // insert mkto attributes to text divs
  replacer = new RegExp(textDiv);
  while (textDivs.length > 0) {
    string = string.replace(textDiv, `<div class="mktoText" mktoname="${generator()}" id="${generator()}" style="font-family`);
    textDivs.pop();
  }

  // get marketo text variables
  const textVarNames = getMatches(string, /(?<=\${text: *("|')?)(([a-z]|[A-Z])([a-z]|[A-Z]|[0-9])*)(?=("|')? *; default:.*})/g);
  const textVarDefaults = getMatches(string, /(?<=\${text: *.* *; *default: *("|')?)(?! )([^"|']([À-ú]|[a-z ]|[A-Z]|[0-9]|[!-@]|[[-`]|[{-~])*[^"|'])(?<! )(?=(("|')?) *(}))/g);
  const textVarEntries = filterDuplicates(tupleArrayFromEntries(textVarNames, textVarDefaults));

  // insert meta tags and place variables
  string = insertMeta(string, /(?<=<meta name="viewport" content="width=device-width, initial-scale=1">)(\n)/, textVarEntries);
  string = placeVariables(textVarEntries, string);

  // get marketo number variables
  const numberVarNames = getMatches(string, /(?<=\${number: *("|')?)(([a-z]|[A-Z])([a-z]|[A-Z]|[0-9])*)(?=("|')? *; default:.*})/g);
  const numberVarDefaults = getMatches(string, /(?<=\${number: *.* *; *default: *)(?! )(([0-9])*)(?<! )(?= *(}))/g);
  const numberVarEntries = filterDuplicates(tupleArrayFromEntries(numberVarNames, numberVarDefaults));

  // insert meta tags and place variables
  string = insertMeta(string, /(?<=<meta name="viewport" content="width=device-width, initial-scale=1">)(\n)/, numberVarEntries);
  string = placeVariables(numberVarEntries, string);

  // get marketo color variables
  const colorVarNames = getMatches(string, /(?<=\${color: *("|')?)(([a-z]|[A-Z])([a-z]|[A-Z]|[0-9])*)(?=("|')? *; default:.*})/g);
  const colorVarDefaults = getMatches(string, /(?<=\${color: *.* *; *default: *)(?! )(#([A-Z]|[a-z]|[0-9])*)(?<! )(?= *(}))/g);
  const colorVarEntries = filterDuplicates(tupleArrayFromEntries(colorVarNames, colorVarDefaults));

  // insert meta tags and place variables
  string = insertMeta(string, /(?<=<meta name="viewport" content="width=device-width, initial-scale=1">)(\n)/, colorVarEntries);
  string = placeVariables(colorVarEntries, string);

  // beautify
  string = beautifyHTML(string);

  return string;
}

function tupleArrayFromEntries(keys: string[], values: string[]): [string, string][] {
  const result: [string, string][] = [];

  for (let i = 0; i < keys.length; i++) {
    result.push([keys[i], values[i]]);
  }

  return result;
}

function filterDuplicates(array: [string, string][]): [string, string][] {
  let result: [string, string][] = [];
  const map = new Map();

  for (const [name, def] of array) {
    if (!map.has(name)) {
      map.set(name, true);
      result.push([name, def]);
    }
  }

  return result;
}

function placeVariables(array: [string, string][], html: string): string {
  let result = html;

  for (const variable of array) {
    const template = `(?<=${'\\'}\${)[^{}]*${variable[0]}[^{}]*(?=})`;
    const reg = new RegExp(template, 'g');
    result = result.replace(reg, variable[0]);
  }

  return result;
}

function getMatches(html: string, regex: RegExp): string[] {
  let result: string[] = [];

  const textVarReg = regex;
  const textVarMatches = html.matchAll(textVarReg);
  for (const match of textVarMatches) {
    result.push(match[0]);
  }

  return result;
}

function insertMeta(html: string, regex: RegExp, entries: [string, string][]): string {
  let result: string = html;

  for (const entry of entries) {
    result = result.replace(regex, `\n    <meta class="mktoString" id="${entry[0]}" mktomodulescope="true" mktoname="${entry[0]}" default="${entry[1]}">\n`);
  }

  return result;
}