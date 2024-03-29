import mjml2html from 'mjml';
import { __dirname } from '../api/filesystem.js';
import { downloadFile } from '../api/supabase.js';
import beautify, { HTMLBeautifyOptions } from 'js-beautify';
import { Broadcaster } from '../api/broadcaster.js';

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
  sectionClasses = '(?<=^ {6}<div class=")(?!mj)(.+)(?=" style)',
  imgTag = '(?<!<div.*>\n.*)<img.*\/>',
  textTag = '(?<=<td.*\n.*)<div style="font-family',
  topDiv = '<div.*>(?=\n *<!)',
  bottomDiv = '<\/div>(?=\n.*<\/body>)',
  middleSection = ' {6}<\/div>\n {6}<!--.*\n.*<div class.*600px;">\n {8}<table align="center"',
  topSection = ' {6}<!--.*\n.*max-width:600px;">\n *<table align="center"',
  bottomSection = '<\/div>\n *<!.*\n(?=.*\n.*\n.*\n.*\n.*<\/body>)',
  textVarNames = '(?<=\\${text: *([\'])?)(?! )[\\w ]+(?<! )(?=\\1 *; *default: *([\'])?[\\-\\w:/. ]+\\2 *})',
  textVarDefaults = '(?<=\\${text: *[\']?[\\w ]+[\']? *; *default: *([\']?))(?! )[\\-\\w:/. ]+(?! )(?=\\1 *})',
  numberVarNames = '(?<=\\${number: *([\'])?)(?! )[\\w ]+(?<! )(?=\\1 *; *default: *([\'])?[0-9]+\\2 *})',
  numberVarDefaults = '(?<=\\${number: *[\']?[\\w ]+[\']? *; *default: *([\']?))(?! )[0-9]+(?=\\1 *})',
  colorVarNames = '(?<=\\${color: *([\'])?)(?! )[\\w ]+(?<! )(?=\\1 *; *default: *([\'])?#(\\w{6}|\\w{3})\\2 *})',
  colorVarDefaults = '(?<=\\${color: *[\']?[\\w ]+[\']? *; *default: *([\']?))#(?:\\w{6}|\\w{3})(?=\\1 *})',
}

enum InsertExpression {
  topDiv = '<table class="mj-full-width-mobile" align="center"><tbody><tr><td class="mktoContainer" id="container" width="600" style="width: 600px;">',
  bottomDiv = '</td></tr></tbody></table>',
  meta = '(?<=<meta name="viewport" content="width=device-width, initial-scale=1">)(\n)',
}

export async function downloadMJML(projectName: string, marketo: boolean = false, broadcaster: Broadcaster, operationType: 'normal' | 'email', emailName?: string): Promise<Blob> {
  try {
    const { data, error } = await downloadFile(projectName, 'mjml', marketo, operationType, undefined, emailName);
    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error('Data is empty!');
    }
    return data
  }

  catch (error) {
    broadcaster.error(error as string);
    process.exit(1);
  }
}

export function parseMJML(mjml: string, marketo?: boolean): string {
  const string = mjml;
  const htmlObject = mjml2html(string, { validationLevel: 'soft', keepComments: false });
  const html = beautifyHTML(htmlObject.html);

  if (marketo) {
    const parsedHTML =  marketoParse(html);
    return parsedHTML
  }

  return html;
}

export function marketoParse(html: string): string {
  let string = html;

  // get classes from sections
  let sectionClasses: string[] = getMatches(string, ReplacerRegex.sectionClasses, 'gm');
  const topSectionClass = [sectionClasses[0]];
  const nextSectionClasses = sectionClasses.splice(1);

  // get img and text tags
  let imgTags: string[] = getMatches(string, ReplacerRegex.imgTag, 'g');
  let textDivs: string[] = getMatches(string, ReplacerRegex.textTag, 'g');

  // replace top divs with table and remove section divs (except last section div)
  string = replaceString(string, ReplacerRegex.topDiv, InsertExpression.topDiv);
  string = replaceString(string, ReplacerRegex.bottomDiv, InsertExpression.bottomDiv);
  string = replaceString(string, ReplacerRegex.middleSection, undefined, undefined, nextSectionClasses);
  string = replaceString(string, ReplacerRegex.topSection, undefined, undefined, topSectionClass);

  string = beautifyHTML(string);

  // remove last section div, wrap img tags with mkto divs and make texs divs into mkto divs
  string = replaceString(string, ReplacerRegex.bottomSection, '');
  string = replaceString(string, ReplacerRegex.imgTag, undefined, undefined, undefined, imgTags);
  string = replaceString(string, ReplacerRegex.textTag, undefined, undefined, undefined, undefined, textDivs);

  // get marketo text variables
  const textVarNames = getMatches(string, ReplacerRegex.textVarNames, 'g');
  const textVarDefaults = getMatches(string, ReplacerRegex.textVarDefaults, 'g');
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

  string = beautifyHTML(string);

  return string;
}

function beautifyHTML(html: string): string {
  let beautifiedHTML = html_beautify(html, beautifyOptions);
  return beautifiedHTML;
}

/**
 * @returns a random string of two letters and a number to name IDs
 */
function generator(): () => string {
  let count = 0;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const char1 = chars.charAt(Math.floor(Math.random() * chars.length));
  const char2 = chars.charAt(Math.floor(Math.random() * chars.length));

  function increment() {
    count++;
    return `${char1}${char2}${count}`
  }

  return increment;
}

function getMatches(html: string, regex: ReplacerRegex, flag?: 'g' | 'gm'): string[] {
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
  const counter = generator();

  if (sectionArray) {
    while (sectionArray.length > 0) {
      const sectionClass = sectionArray.shift();
      let classes: string[] = [];

      if (sectionClass) {
        classes = sectionClass.split(' ');
      }

      let string: string = `<table align="center" class="${classes[0]} mktoModule" mktoname="${classes[0]}"`;

      if (sectionClass?.match('mktoInactive') || sectionClass?.match('mktoinactive')) {
        string += ' mktoactive="false"'
      }

      if (sectionClass?.match('mktoNoAdd') || sectionClass?.match('mktonoadd')) {
        string += ' mktoaddbydefault="false"'
      }

      string += ` id="${counter()}"`

      result = result.replace(replacer, string);
    }
    return result;
  }

  if (imgArray) {
    while (imgArray.length > 0) {
      const img = imgArray.shift();
      result = result.replace(replacer, `<div class="mktoImg" mktoname="${counter()}" id="${counter()}">\n${img}</div>`);
    }
    return result;
  }

  if (textArray) {
    while (textArray.length > 0) {
      result = result.replace(replacer, `<div class="mktoText" mktoname="${counter()}" id="${counter()}" style="font-family`);
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