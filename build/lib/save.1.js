import { readFileSync, writeFileSync } from 'node:fs';
import { __dirname } from '../api/filesystem.js';
export function save(type, key, value) {
    let info = JSON.parse(readFileSync(__dirname + `config\\${type}.json`, { encoding: 'utf8' }));
    info[key] = value;
    const infoString = JSON.stringify(info, null, 2);
    writeFileSync(__dirname + `config\\${type}.json`, infoString);
}
