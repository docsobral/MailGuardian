import mjml2html from 'mjml';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import selectFolder from 'win-select-folder';
import { __dirname, getFile } from '../api/filesystem.js';
import beautify, { HTMLBeautifyOptions } from 'js-beautify';
import { EnquireMessages, EnquireNames, EnquireTypes, enquire } from '../api/enquire.js';
import { broadcaster } from '../bin/index.js';

const { html_beautify } = beautify;

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

function beautifyHTML(html: string): string {
  let beautifiedHTML = html_beautify(html, beautifyOptions);
  return beautifiedHTML;
}

type FolderSelectOptions = {
  root: string;
  description: string;
  newFolder: number;
}

export async function getFolder(): Promise<string> {
  const options: FolderSelectOptions = {
    root: 'Desktop',
    description: 'Find the project folder:',
    newFolder: 0,
  }

  return await selectFolder(options);
}

export type CompilerOptions = {
  folderPath: string,
  fileName: string,
  insertAuthor?: boolean,
  taskCode?: string,
  insertIF?: boolean,
  watch?: boolean,
  insertLabels?: boolean,
}

async function insertLabels(html: string): Promise<string> {
  let result: string = html;

  function getAnchors(html: string) {
    // const finder = /(?<=<a.*"\s?>\n?)(.*)(?=\n? *<\/a>)/g;
    const finder = /(?<=<a.*href=".*">\s*)(.*?)(?=\s*<\/a>)/g;
    const finds = html.matchAll(finder);
    return finds;
  }

  const finds = getAnchors(result);
  let done: boolean | undefined = false;

  while (!done) {
    const next = finds.next();
    const value = next.value;
    done = next.done;

    if (done) break;

    broadcaster.solve(`\nFound this anchor: ${broadcaster.color(value[0].trim(), 'green')}`);
    const { addLabel } = await enquire([
      {
        type: EnquireTypes.confirm,
        name: EnquireNames.addLabel,
        message: EnquireMessages.addLabel
      }
    ]);

    if (addLabel) {
      const { label } = await enquire([
        {
          type: EnquireTypes.input,
          name: EnquireNames.label,
          message: EnquireMessages.label
        }
      ]);

      const labelTag = `<b style="display:none;color:#ffffff;">${label}</b>`;
      const finder = value[0];
      const replacer = labelTag + next.value[0];
      result = result.replace(finder, replacer);
    }
  }

  result = beautifyHTML(result);

  return result;
}

function insertAuthor(html: string, taskCode: string | undefined): string {
  const finder = /(?<=<meta name="viewport" content="width=device-width, initial-scale=1">)(\n)/;
  const content = taskCode ? `${taskCode} | Development Performance - Valtech` : 'Development Performance - Valtech';
  const replacer = `\n    <meta name="author" content="${content}">\n`;
  return html.replace(finder, replacer);
}

function insertIF(html: string): string {
  const IF =
  `%%[IF '1'=='0' THEN]%%
    <table cellpadding="2" cellspacing="0" width="600" ID="Table5" Border=0>
      <tr>
        <td>
          <font face="verdana" size="1" color="#444444">This email was sent by: <b>%%Member_Busname%%</b> <br>%%Member_Addr%% %%Member_City%%, %%Member_State%%, %%Member_PostalCode%%, %%Member_Country%%<br><br></font>
        </td>
      </tr>
    </table>
    <a href="%%profile_center_url%%" alias="Update Profile">Update Profile</a>
  %%[ENDIF]%%`;

  const finder = /(\n)(?=<\/html>)/;
  const replacer = `\n${IF}\n\n`;

  return html.replace(finder, replacer);
}

export async function compileHTML(options: CompilerOptions): Promise<['success' | 'error', any, string]> {
  try {
    const folderPath = options.folderPath;
    const fileName: string = options.fileName;
    const mjml: string = await getFile('mjml', folderPath, false, fileName);
    let htmlString = beautifyHTML(mjml2html(mjml, { validationLevel: 'soft' }).html);

    if (options.insertAuthor) {
      htmlString = insertAuthor(htmlString, options.taskCode);
    }

    if (options.insertLabels) {
      htmlString = await insertLabels(htmlString);
    }

    if (options.insertIF) {
      htmlString = insertIF(htmlString);
    }

    writeFileSync(resolve(folderPath, fileName + '.html'), htmlString, { encoding: 'utf8' });
    return ['success', '', resolve(folderPath, fileName + '.html')];
  }

  catch (error: any) {
    return ['error', error, ''];
  }
}