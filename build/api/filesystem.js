import { enquire, EnquireMessages, EnquireNames, EnquireTypes } from './enquire.js';
import { readFile, mkdir, writeFile, readdir, unlink, rm } from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, basename } from 'path';
import { exec } from 'child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'url';
import Cryptr from 'cryptr';
import chalk from 'chalk';
function escapeBackslashes(path) {
    const pathArray = path.split('');
    let newArray = [];
    for (let char of pathArray) {
        char !== '\\' ? newArray.push(char) : newArray.push('\\\\');
    }
    ;
    return newArray.join('');
}
;
const __filename = dirname(fileURLToPath(import.meta.url));
export const __dirname = escapeBackslashes(__filename.split('build')[0]);
export function absolutePath(path) {
    if (path.startsWith('C:\\')) {
        return path;
    }
    else {
        return resolve(__dirname, path);
    }
}
export function pathAndFile(path) {
    return [dirname(path), basename(path)];
}
export async function getFile(fileType, pathToFile, marketo = false, fileName = 'index') {
    let string;
    if (fileType === 'html') {
        string = (await readFile(pathToFile + `\\${fileName}.html`)).toString();
        return string;
    }
    string = (await readFile(pathToFile + `\\${marketo ? 'marketo' : 'index'}.mjml`)).toString();
    return string;
}
export async function getImage(path, imageName) {
    let image;
    image = await readFile(path + `\\img\\${imageName}`);
    return image;
}
export async function saveFile(path, name, file) {
    await writeFile(`${path}\\${name}`, file);
}
export async function checkFirstUse() {
    if (!existsSync(__dirname + 'config')) {
        console.log(`${chalk.blue('Creating save files...\n')}`);
        await mkdir(__dirname + 'config');
        writeFile(__dirname + 'config\\paths.json', JSON.stringify({}, null, 2));
        const initialState = { logged: [false, false] };
        writeFile(__dirname + 'config\\state.json', JSON.stringify(initialState, null, 2));
        const answers = await enquire([
            {
                type: EnquireTypes.input,
                name: EnquireNames.supabaseSecret,
                message: EnquireMessages.supabaseSecret
            },
            {
                type: EnquireTypes.input,
                name: EnquireNames.supabaseURL,
                message: EnquireMessages.supabaseURL
            },
            {
                type: EnquireTypes.input,
                name: EnquireNames.secretKey,
                message: EnquireMessages.secretKey
            }
        ]);
        const appConfigs = {
            'SUPA_SECRET': answers.supabaseSecret,
            'SUPA_URL': answers.supabaseURL,
            'SECRET_KEY': answers.secretKey,
        };
        await writeFile(__dirname + 'config\\config.json', JSON.stringify(appConfigs, null, 2));
        console.log(`${chalk.yellow('Finished creating config files and terminating process. Now run \'mailer login <email> <passoword>\'.')}`);
        process.exit(0);
    }
    ;
}
export async function createFolders(templateName) {
    if (!existsSync(__dirname + 'downloads')) {
        await mkdir(__dirname + 'downloads');
    }
    if (!existsSync(__dirname + 'temp')) {
        await mkdir(__dirname + 'temp');
    }
    if (!existsSync(__dirname + 'templates')) {
        await mkdir(__dirname + 'templates');
    }
    if (!existsSync(__dirname + 'components')) {
        await mkdir(__dirname + 'components');
    }
}
const newMJML = `<mjml>
  <mj-head>
    <mj-style>
      
    </mj-style>
  </mj-head>

  <mj-body background-color="#ffffff">

  </mj-body>
</mjml>`;
export async function manageTemplate(name, remove, type) {
    let manage;
    let options = {};
    if (!remove) {
        manage = mkdir;
    }
    else {
        manage = rm;
        options = { recursive: true, force: true };
    }
    await manage(__dirname + `${type}s\\${name}`, options);
    await manage(__dirname + `${type}s\\${name}\\img`, options);
    if (!remove) {
        writeFileSync(__dirname + `${type}s\\${name}\\index.mjml`, newMJML);
    }
}
export async function openVS(name, type) {
    exec(`${process.platform === 'win32' ? 'code.cmd' : 'code'} "${__dirname}\\${type}s\\${name}"`, (error, stdout, stderr) => {
        if (error) {
            throw new Error(`Error executing the command: ${error.message}`);
        }
        else {
            console.log('Folder opened in VSCode.');
        }
    });
}
export async function cleanTemp() {
    const files = await readdir(__dirname + 'temp');
    for (let file of files) {
        await unlink(__dirname + `temp\\${file}`);
    }
}
export async function getState() {
    const config = JSON.parse((await readFile(__dirname + 'config\\config.json')).toString('utf8'));
    const cryptr = new Cryptr(config['SECRET_KEY']);
    let state = JSON.parse((await readFile(__dirname + 'config\\state.json')).toString('utf8'));
    Object.keys(state).forEach(key => {
        if (state[key][1]) {
            state[key] = [cryptr.decrypt(state[key][0].toString()), true];
        }
    });
    return state;
}
export function saveState(key, value, encrypt = false) {
    const config = JSON.parse(readFileSync(__dirname + 'config\\config.json', { encoding: 'utf8' }));
    const cryptr = new Cryptr(config['SECRET_KEY']);
    let finalValue;
    let state = JSON.parse(readFileSync(__dirname + 'config\\state.json', { encoding: 'utf8' }));
    if (encrypt && typeof value === 'string') {
        finalValue = cryptr.encrypt(value);
        state[key] = [finalValue, encrypt];
    }
    else {
        state[key] = [value, encrypt];
    }
    const stateString = JSON.stringify(state, null, 2);
    writeFileSync(__dirname + 'config\\state.json', stateString);
}
export function getConfigAndPath() {
    const config = JSON.parse(readFileSync(__dirname + `config\\config.json`, { encoding: 'utf8' }));
    const paths = Object.entries(JSON.parse(readFileSync(__dirname + `config\\paths.json`, { encoding: 'utf8' })));
    return { config, paths };
}
export function save(type, key, value) {
    let info = JSON.parse(readFileSync(__dirname + `config\\${type}.json`, { encoding: 'utf8' }));
    info[key] = value;
    const infoString = JSON.stringify(info, null, 2);
    writeFileSync(__dirname + `config\\${type}.json`, infoString);
}
export function getVersion() {
    return `Current version is v${JSON.parse(readFileSync(resolve(__dirname, 'package.json'), { encoding: 'utf8' })).version}`;
}
