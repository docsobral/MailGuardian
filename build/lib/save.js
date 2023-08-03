import { readFileSync, writeFileSync } from 'node:fs';
import { __dirname } from '../api/filesystem.js';
import Cryptr from 'cryptr';
export async function getState() {
    const config = JSON.parse(readFileSync(__dirname + 'config\\config.json', { encoding: 'utf8' }));
    const cryptr = new Cryptr(config['SECRET_KEY']);
    let state = JSON.parse(readFileSync(__dirname + 'config\\state.json', { encoding: 'utf8' }));
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
