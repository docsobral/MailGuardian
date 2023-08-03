import chalk from 'chalk';
import mjml2html from 'mjml';
import { downloadFile } from '../api/supabase.js';
import beautify from 'js-beautify';
const { html_beautify } = beautify;
const beautifyOptions = {
    indent_inner_html: true,
    indent_size: 2,
    indent_char: ' ',
    max_preserve_newlines: -1,
    preserve_newlines: false,
    indent_scripts: 'normal',
    end_with_newline: false,
    wrap_line_length: 0,
    indent_empty_lines: false
};
var ReplacerRegex;
(function (ReplacerRegex) {
    ReplacerRegex["sectionClasses"] = "(?<=^ {6}<div class=\")(?!mj)(.+)(?=\" style)";
    ReplacerRegex["imgTag"] = "(?<!<div.*>\n.*)<img.*/>";
    ReplacerRegex["textTag"] = "(?<=<td.*\n.*)<div style=\"font-family";
    ReplacerRegex["topDiv"] = "<div.*>(?=\n *<!)";
    ReplacerRegex["bottomDiv"] = "</div>(?=\n.*</body>)";
    ReplacerRegex["middleSection"] = " {6}</div>\n {6}<!--.*\n.*<div class.*600px;\">\n {8}<table align=\"center\"";
    ReplacerRegex["topSection"] = " {6}<!--.*\n.*max-width:600px;\">\n *<table align=\"center\"";
    ReplacerRegex["bottomSection"] = "</div>\n *<!.*\n(?=.*\n.*\n.*\n.*\n.*</body>)";
    ReplacerRegex["textVarNames"] = "(?<=\\${text: *(['])?)(?! )[\\w ]+(?<! )(?=\\1 *; *default: *(['])?[\\-\\w:/. ]+\\2 *})";
    ReplacerRegex["textVarDefaults"] = "(?<=\\${text: *[']?[\\w ]+[']? *; *default: *([']?))(?! )[\\-\\w:/. ]+(?! )(?=\\1 *})";
    ReplacerRegex["numberVarNames"] = "(?<=\\${number: *(['])?)(?! )[\\w ]+(?<! )(?=\\1 *; *default: *(['])?[0-9]+\\2 *})";
    ReplacerRegex["numberVarDefaults"] = "(?<=\\${number: *[']?[\\w ]+[']? *; *default: *([']?))(?! )[0-9]+(?=\\1 *})";
    ReplacerRegex["colorVarNames"] = "(?<=\\${color: *(['])?)(?! )[\\w ]+(?<! )(?=\\1 *; *default: *(['])?#(\\w{6}|\\w{3})\\2 *})";
    ReplacerRegex["colorVarDefaults"] = "(?<=\\${color: *[']?[\\w ]+[']? *; *default: *([']?))#(?:\\w{6}|\\w{3})(?=\\1 *})";
})(ReplacerRegex || (ReplacerRegex = {}));
var InsertExpression;
(function (InsertExpression) {
    InsertExpression["topDiv"] = "<table class=\"mj-full-width-mobile\" align=\"center\"><tbody><tr><td class=\"mktoContainer\" id=\"container\" width=\"600\" style=\"width: 600px;\">";
    InsertExpression["bottomDiv"] = "</td></tr></tbody></table>";
    InsertExpression["meta"] = "(?<=<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">)(\n)";
})(InsertExpression || (InsertExpression = {}));
export async function downloadMJML(projectName, marketo = false) {
    try {
        const { data, error } = await downloadFile(projectName, 'mjml', marketo);
        if (error) {
            throw new Error('Failed to get MJML file! Check the project name or the project bucket');
        }
        return data;
    }
    catch (error) {
        console.error(`${chalk.red(error)}`);
        process.exit(1);
    }
}
export function parseMJML(mjml, marketo) {
    const string = mjml;
    const htmlObject = mjml2html(string, { validationLevel: 'soft' });
    const html = beautifyHTML(htmlObject.html);
    if (marketo) {
        const parsedHTML = marketoParse(html);
        return parsedHTML;
    }
    return html;
}
export function marketoParse(html) {
    let string = html;
    let sectionClasses = getMatches(string, ReplacerRegex.sectionClasses, 'gm');
    const topSectionClass = [sectionClasses[0]];
    const nextSectionClasses = sectionClasses.splice(1);
    let imgTags = getMatches(string, ReplacerRegex.imgTag, 'g');
    let textDivs = getMatches(string, ReplacerRegex.textTag, 'g');
    string = replaceString(string, ReplacerRegex.topDiv, InsertExpression.topDiv);
    string = replaceString(string, ReplacerRegex.bottomDiv, InsertExpression.bottomDiv);
    string = replaceString(string, ReplacerRegex.middleSection, undefined, undefined, nextSectionClasses);
    string = replaceString(string, ReplacerRegex.topSection, undefined, undefined, topSectionClass);
    string = beautifyHTML(string);
    string = replaceString(string, ReplacerRegex.bottomSection, '');
    string = replaceString(string, ReplacerRegex.imgTag, undefined, undefined, undefined, imgTags);
    string = replaceString(string, ReplacerRegex.textTag, undefined, undefined, undefined, undefined, textDivs);
    const textVarNames = getMatches(string, ReplacerRegex.textVarNames, 'g');
    const textVarDefaults = getMatches(string, ReplacerRegex.textVarDefaults, 'g');
    const textVarEntries = filterDuplicates(tupleArrayFromEntries(textVarNames, textVarDefaults));
    const numberVarNames = getMatches(string, ReplacerRegex.numberVarNames, 'g');
    const numberVarDefaults = getMatches(string, ReplacerRegex.numberVarDefaults, 'g');
    const numberVarEntries = filterDuplicates(tupleArrayFromEntries(numberVarNames, numberVarDefaults));
    const colorVarNames = getMatches(string, ReplacerRegex.colorVarNames, 'g');
    const colorVarDefaults = getMatches(string, ReplacerRegex.colorVarDefaults, 'g');
    const colorVarEntries = filterDuplicates(tupleArrayFromEntries(colorVarNames, colorVarDefaults));
    string = insertMeta(string, InsertExpression.meta, textVarEntries, 'String');
    string = insertMeta(string, InsertExpression.meta, numberVarEntries, 'Number');
    string = insertMeta(string, InsertExpression.meta, colorVarEntries, 'Color');
    string = placeVariables([...textVarEntries, ...numberVarEntries, ...colorVarEntries], string);
    string = beautifyHTML(string);
    return string;
}
function beautifyHTML(html) {
    let beautifiedHTML = html_beautify(html, beautifyOptions);
    return beautifiedHTML;
}
function generator() {
    let count = 0;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const char = chars.charAt(Math.floor(Math.random() * chars.length));
    function increment() {
        count++;
        return `${char}${count}`;
    }
    return increment;
}
function getMatches(html, regex, flag) {
    let result = [];
    const reg = new RegExp(regex, flag);
    const matches = html.matchAll(reg);
    for (const match of matches) {
        result.push(match[0]);
    }
    return result;
}
function replaceString(html, regex, expression, flags, sectionArray, imgArray, textArray) {
    let result = html;
    const replacer = new RegExp(regex, flags);
    const counter = generator();
    if (sectionArray) {
        while (sectionArray.length > 0) {
            const sectionClass = sectionArray.shift();
            let classes = [];
            if (sectionClass) {
                classes = sectionClass.split(' ');
            }
            let string = `<table align="center" class="${classes[0]} mktoModule" mktoname="${classes[0]}"`;
            if ((sectionClass === null || sectionClass === void 0 ? void 0 : sectionClass.match('mktoInactive')) || (sectionClass === null || sectionClass === void 0 ? void 0 : sectionClass.match('mktoinactive'))) {
                string += ' mktoactive="false"';
            }
            if ((sectionClass === null || sectionClass === void 0 ? void 0 : sectionClass.match('mktoNoAdd')) || (sectionClass === null || sectionClass === void 0 ? void 0 : sectionClass.match('mktonoadd'))) {
                string += ' mktoaddbydefault="false"';
            }
            string += ` id="${counter()}"`;
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
function tupleArrayFromEntries(keys, values) {
    const result = [];
    for (let i = 0; i < keys.length; i++) {
        result.push([keys[i], values[i]]);
    }
    return result;
}
function filterDuplicates(array) {
    let result = [];
    const map = new Map();
    for (const [name, def] of array) {
        if (!map.has(name)) {
            map.set(name, true);
            result.push([name, def]);
        }
    }
    return result;
}
function placeVariables(array, html) {
    let result = html;
    for (const variable of array) {
        const template = `(?<=${'\\'}\${)[^{}]*${variable[0]}[^{}]*(?=})`;
        const reg = new RegExp(template, 'g');
        result = result.replace(reg, variable[0]);
    }
    return result;
}
function insertMeta(html, regex, entries, type) {
    let result = html;
    const reg = new RegExp(regex);
    for (const entry of entries) {
        result = result.replace(reg, `\n    <meta class="mkto${type}" id="${entry[0]}" mktomodulescope="true" mktoname="${entry[0]}" default="${entry[1]}">\n`);
    }
    return result;
}
