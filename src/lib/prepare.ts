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

enum ReplacerRegex {
  imgTag = '(?<!<div.*>\n.*)(<img.*\/>)',
  textTag = '(?<=<td.*\n.*)(<div style="font-family)',
  topDiv = '(<div)(.*)(>)(?=\n *<!)',
  bottomDiv = '(<\/div>)(?=\n.*<\/body>)',
  middleSection = '( *)(<\/div>)(\n)(      )(<!--)(.*)(\n)(.*)(<div class.*)(600px;">\n *)(<table align="center")',
  topSection = '(<!--)(.*)(\n)(.*)(max-width:600px;">\n *)(<table align="center")',
  bottomSection = '(<\/div>\n)( *<!.*\n)(?=.*\n.*\n.*\n.*\n.*<\/body>)',
  textVarNames = '(?<=\\${text: *("|\')?)(([a-z]|[A-Z])([a-z]|[A-Z]|[0-9])*)(?=("|\')? *; default:.*})',
  textVarDefaults = '(?<=\\${text: *.* *; *default: *("|\')?)(?! )([^"|\']([À-ú]|[a-z ]|[A-Z]|[0-9]|[!-@]|[[-`]|[{-~])*[^"|\'])(?<! )(?=(("|\')?) *(}))',
  numberVarNames = '(?<=\\${number: *("|\')?)(([a-z]|[A-Z])([a-z]|[A-Z]|[0-9])*)(?=("|\')? *; default:.*})',
  numberVarDefaults = '(?<=\\${number: *.* *; *default: *)(?! )(([0-9])*)(?<! )(?= *(}))',
  colorVarNames = '(?<=\\${color: *("|\')?)(([a-z]|[A-Z])([a-z]|[A-Z]|[0-9])*)(?=("|\')? *; default:.*})',
  colorVarDefaults = '(?<=\\${color: *.* *; *default: *)(?! )(#([A-Z]|[a-z]|[0-9])*)(?<! )(?= *(}))',
}

enum InsertExpression {
  topDiv = '<table class="mj-full-width-mobile" align="center"><tbody><tr><td class="mktoContainer" id="container" width="600" style="width: 600px;">',
  bottomDiv = '</td></tr></tbody></table>',
  meta = '(?<=<meta name="viewport" content="width=device-width, initial-scale=1">)(\n)',
}

export async function downloadMJML(projectName: string, marketo: boolean = false) {
  try {
    const type = marketo ? 'marketo' : 'index';
    const { data, error } = await downloadFile(projectName, 'mjml', type);
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

  // get classes from sections
  let sectionClasses: string[] = getMatches(string, /(?<=^      <div class=")(?!mj)(.+)(?=" style)/, 'gm');

  const topSectionClass = [sectionClasses[0]];
  const nextSectionClasses = sectionClasses.splice(1);

  // get img tags
  let imgTags: string[] = getMatches(string, ReplacerRegex.imgTag, 'g');

  // get text divs
  let textDivs: string[] = getMatches(string, ReplacerRegex.textTag, 'g');

  // top <div> to <table><tbody><tr><td>
  string = replaceString(string, ReplacerRegex.topDiv, InsertExpression.topDiv);

  // end </div> to </td></tr></tbody></table>
  string = replaceString(string, ReplacerRegex.bottomDiv, InsertExpression.bottomDiv);

  // middle second div + ghost table opening (closing div)
  string = replaceString(string, ReplacerRegex.middleSection, undefined, undefined, nextSectionClasses);

  // top div + ghost table opening
  string = replaceString(string, ReplacerRegex.topSection, undefined, undefined, topSectionClass);

  // beautify
  string = beautifyHTML(string);

  // end div + ghost table opening
  string = replaceString(string, ReplacerRegex.bottomSection, '');

  // surround img tags with divs
  string = replaceString(string, ReplacerRegex.imgTag, undefined, undefined, undefined, imgTags);

  // insert mkto attributes to text divs
  string = replaceString(string, ReplacerRegex.textTag, undefined, undefined, undefined, undefined, textDivs);

  // get marketo text variables
  const textVarNames = getMatches(string, ReplacerRegex.textVarNames, 'g');
  console.log(ReplacerRegex.textVarNames, textVarNames)
  const textVarDefaults = getMatches(string, ReplacerRegex.textVarDefaults, 'g');
  console.log(ReplacerRegex.textVarDefaults, textVarDefaults)
  const textVarEntries = filterDuplicates(tupleArrayFromEntries(textVarNames, textVarDefaults));

  // get marketo number variables
  const numberVarNames = getMatches(string, ReplacerRegex.numberVarNames, 'g');
  const numberVarDefaults = getMatches(string, ReplacerRegex.numberVarDefaults, 'g');
  const numberVarEntries = filterDuplicates(tupleArrayFromEntries(numberVarNames, numberVarDefaults));

  // get marketo color variables
  const colorVarNames = getMatches(string, ReplacerRegex.colorVarNames, 'g');
  const colorVarDefaults = getMatches(string, ReplacerRegex.colorVarDefaults, 'g');
  const colorVarEntries = filterDuplicates(tupleArrayFromEntries(colorVarNames, colorVarDefaults));

  // insert meta tags and place variables
  string = insertMeta(string, InsertExpression.meta, textVarEntries, 'String');
  string = insertMeta(string, InsertExpression.meta, numberVarEntries, 'Number');
  string = insertMeta(string, InsertExpression.meta, colorVarEntries, 'Color');
  string = placeVariables([...textVarEntries, ...numberVarEntries, ...colorVarEntries], string);

  // beautify
  string = beautifyHTML(string);

  return string;
}

let count = 0;
function generator() {
  count++
  return `a${count}`
}

function getMatches(html: string, regex: RegExp | ReplacerRegex, flag?: 'g' | 'gm'): string[] {
  let result: string[] = [];
  const reg = new RegExp(regex, flag);

  const matches = html.matchAll(reg);
  for (const match of matches) {
    result.push(match[0]);
  }

  return result;
}

function replaceString(html: string, regex: ReplacerRegex, expression?: InsertExpression | '', flags?: 'g' | 'gm', sectionArray?: string[], imgArray?: string[], textArray?: string[]): string {
  let result = html;
  const replacer = new RegExp(regex, flags);

  if (sectionArray) {
    while (sectionArray.length > 0) {
      const sectionClass = sectionArray.shift();
      result = result.replace(replacer, `<table align="center" class="mktoModule mj-full-width-mobile ${sectionClass}" mktoname="${sectionClass}" id="${generator()}"`)
    }
    return result;
  }

  if (imgArray) {
    while (imgArray.length > 0) {
      const img = imgArray.shift();
      result = result.replace(replacer, `<div class="mktoImg" mktoname="${generator()}" id="${generator()}">\n${img}</div>`);
    }
    return result;
  }

  if (textArray) {
    while (textArray.length > 0) {
      result = result.replace(replacer, `<div class="mktoText" mktoname="${generator()}" id="${generator()}" style="font-family`);
      textArray.pop();
    }
    return result;
  }

  if (!expression && expression !== '') {
    throw new Error('Missing expression parameter!');
  }

  result = result.replace(replacer, expression);
  return result;
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

function insertMeta(html: string, regex: string, entries: [string, string][], type: 'String' | 'Color' | 'Number'): string {
  let result: string = html;
  const reg = new RegExp(regex);

  for (const entry of entries) {
    result = result.replace(reg, `\n    <meta class="mkto${type}" id="${entry[0]}" mktomodulescope="true" mktoname="${entry[0]}" default="${entry[1]}">\n`);
  }

  return result;
}