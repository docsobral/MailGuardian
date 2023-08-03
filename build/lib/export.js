import ora from 'ora';
import chalk from 'chalk';
import Watch from 'node-watch';
import { readdir } from 'node:fs/promises';
import selectFolder from 'win-select-folder';
import { getFile, getImage } from '../api/filesystem.js';
import { listFiles, fileExists, uploadFile, updateFile } from '../api/supabase.js';
export async function getPath() {
    const options = {
        root: 'Desktop',
        description: 'Find the project folder:',
        newFolder: 0,
    };
    return await selectFolder(options);
}
export async function getMJML(path, marketo = false) {
    const mjml = getFile('mjml', path, marketo);
    return mjml;
}
export async function getImageNames(path) {
    let list = [];
    list = await readdir(path + '\\img');
    return list;
}
export async function getImages(path) {
    let images = {};
    const list = await getImageNames(path);
    for (let image of list) {
        images[image] = await getImage(path, image);
    }
    return images;
}
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
export async function watch(folderPath, projectName, marketo = false) {
    const mjml = await getFile('mjml', folderPath, marketo);
    const filesInBucket = await listFiles(projectName);
    const fileName = marketo ? 'marketo.mjml' : 'index.mjml';
    const mjmlExists = await fileExists(fileName, filesInBucket.data);
    const type = marketo ? 'marketo' : 'index';
    if (!mjmlExists) {
        try {
            console.log(`${chalk.blue('Sending files to bucket')}`);
            const upload = await uploadFile(mjml, `${type}.mjml`, projectName);
            console.log(`${chalk.blue(`Successfully uploaded ${type}.mjml`)}`);
            if (upload.error) {
                throw new Error(`Failed to upload MJML!! ${upload.error.message}`);
            }
        }
        catch (error) {
            console.error(`${chalk.red(error)}`);
        }
        const images = await getImages(folderPath);
        Object.keys(images).forEach(async (imageName) => {
            try {
                const upload = await uploadFile(images[imageName], `img/${imageName}`, projectName, 'image/png');
                if (upload.error) {
                    throw new Error(`Failed to upload ${imageName}! ${upload.error.message}`);
                }
                console.log(`${chalk.blue('Succesfully uploaded', imageName)}`);
            }
            catch (error) {
                console.error(`${chalk.red(error)}`);
            }
        });
    }
    console.log(`${chalk.yellow(`Watching MJML for changes\n`)}`);
    Watch(folderPath + `\\${type}.mjml`, async (evt, filePath) => {
        console.log(`${chalk.yellow(`${capitalizeFirstLetter(evt)} detected at ${filePath}`)}`);
        const newMJML = await getFile('mjml', folderPath, marketo);
        try {
            console.log(`${chalk.blue('Updating MJML')}`);
            await updateFile(newMJML, `${type}.mjml`, projectName);
            console.log(`${chalk.blue('Success!\n')}`);
        }
        catch (error) {
            console.error(`${chalk.red(error)}`);
            process.exit(1);
        }
    });
}
export async function uploadMJML(bucketName, path, marketo = false) {
    try {
        const fileName = marketo ? 'marketo.mjml' : 'index.mjml';
        process.stdout.write('\n');
        const spinner = ora(`${chalk.yellow(`Uploading ${fileName} file...`)}`).start();
        const mjml = await getMJML(path, marketo);
        const upload = await uploadFile(mjml, `${fileName}`, bucketName, 'text/plain');
        if (upload.error) {
            spinner.fail(`${chalk.red(`Failed to upload ${fileName} file!\n`)}`);
            throw new Error(upload.error.stack);
        }
        spinner.succeed(`${chalk.yellow(`Successfully uploaded ${fileName} file!`)}`);
    }
    catch (error) {
        console.warn(`${chalk.red(error)}`);
    }
}
export async function uploadImages(bucketName, path) {
    const images = await getImages(path);
    process.stdout.write('\n');
    const spinner = ora(`${chalk.yellow('Uploading images...')}`).start();
    Object.keys(images).forEach(async (imageName) => {
        const upload = await uploadFile(images[imageName], `img/${imageName}`, bucketName, 'image/png');
        if (upload.error) {
            spinner.text = `${spinner.text}\n${chalk.red(`  Failed to upload ${imageName}! ${upload.error.message}`)}`;
        }
        spinner.text = `${spinner.text}\n${chalk.blue('  Succesfully uploaded', imageName)}`;
    });
    await delay(1000);
    spinner.succeed();
}
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
