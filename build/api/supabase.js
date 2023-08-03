import ora from 'ora';
import chalk from 'chalk';
import { readFileSync } from 'node:fs';
import { __dirname } from './filesystem.js';
import { BucketError } from '../lib/error.js';
import { createClient } from '@supabase/supabase-js';
const config = JSON.parse(readFileSync(__dirname + 'config\\config.json', { encoding: 'utf8' }));
if (typeof config['SUPA_URL'] === 'undefined' || typeof config['SUPA_SECRET'] === 'undefined') {
    throw new Error(`${chalk.red('Missing API url, key or secret key! Please run \'mailer config\' to set them.')}`);
}
const options = { db: { schema: 'public' }, auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } };
const supabase = createClient(config['SUPA_URL'], config['SUPA_SECRET'], options);
export async function createBucket(projectName) {
    let result = await supabase.storage.createBucket(projectName, { public: false });
    return result;
}
export async function deleteBucket(projectName) {
    await supabase.storage.emptyBucket(projectName);
    let result = await supabase.storage.deleteBucket(projectName);
    return result;
}
export async function cleanBucket(projectName) {
    return await supabase.storage.emptyBucket(projectName);
}
export async function uploadFile(file, fileName, projectName, contentType = 'text/plain') {
    let result = await supabase.storage.from(projectName).upload(fileName, file, { contentType: contentType, upsert: true });
    return result;
}
export async function updateFile(file, fileName, projectName, contentType = 'text/plain') {
    let result = await supabase.storage.from(projectName).update(fileName, file, { contentType: contentType, upsert: false });
    return result;
}
export async function listFiles(projectName) {
    return await supabase.storage.from(projectName).list();
}
export async function deleteFile(fileName, projectName) {
    let result = await supabase.storage.from(projectName).remove([`${fileName}`]);
    return result;
}
export async function bucketExists(projectName) {
    let result = await supabase.storage.getBucket(projectName);
    if (result.error) {
        throw new BucketError(`Bucket ${name} doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a template.`);
    }
    return result;
}
export async function downloadFile(projectName, extension, marketo = false, imageName) {
    const type = marketo ? 'marketo' : 'index';
    if (extension === 'mjml') {
        return await supabase.storage.from(projectName).download(`${type}.mjml`);
    }
    else if (extension === 'html') {
        return await supabase.storage.from(projectName).download(`${type}.html`);
    }
    else {
        return await supabase.storage.from(projectName).download(`img/${imageName}`);
    }
}
export async function listImages(projectName) {
    return await supabase.storage.from(projectName).list('img', { sortBy: { column: 'name', order: 'asc' } });
}
export async function imagesUrls(projectName, imageNames) {
    const pathList = imageNames.map(imageName => 'img/' + imageName);
    return supabase.storage.from(projectName).createSignedUrls(pathList, 600);
}
export async function fileExists(name, list) {
    for (let index in list) {
        if (list[index].name === name) {
            return true;
        }
    }
    return false;
}
export async function listBuckets() {
    return await supabase.storage.listBuckets();
}
export async function manageBucket(name, type) {
    var _a;
    let manager = type === 'create' ? createBucket : deleteBucket;
    function capitalizeFirstLetter(string) {
        return `${string[0].toUpperCase() + string.slice(1)}`;
    }
    process.stdout.write('\n');
    const spinner = ora(`${chalk.yellow(`Attempting to ${type} template named ${name}`)}`).start();
    const { error } = await manager(name);
    if (error) {
        spinner.fail();
        throw new BucketError(`\nFailed to ${type} template named ${name}!\n\n${(_a = error.stack) === null || _a === void 0 ? void 0 : _a.slice(17)}`);
    }
    spinner.succeed(`${chalk.yellow(`${capitalizeFirstLetter(type)}d template named ${name}.`)}`);
}
