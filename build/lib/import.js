import { downloadFile, listImages } from '../api/supabase.js';
import { StorageError } from '@supabase/storage-js';
import chalk from 'chalk';
export async function importBucket(projectName, marketo = false) {
    var _a, _b, _c, _d, _e;
    let imgList = [];
    let bucketFiles = {};
    let images = [];
    const fetch = await listImages(projectName);
    if (fetch.error) {
        return new StorageError(`${chalk.red('Download of the images failed!')}`);
    }
    fetch.data.forEach(fileObject => imgList.push(fileObject.name));
    for (let image of imgList) {
        const arrayBuffer = await ((_a = (await downloadFile(projectName, 'png', undefined, image)).data) === null || _a === void 0 ? void 0 : _a.arrayBuffer());
        if (arrayBuffer) {
            const tuple = [image, Buffer.from(arrayBuffer)];
            images.push(tuple);
        }
    }
    bucketFiles.images = images;
    const mjml = await ((_b = (await downloadFile(projectName, 'mjml')).data) === null || _b === void 0 ? void 0 : _b.text());
    const mktomjml = marketo ? await ((_c = (await downloadFile(projectName, 'mjml', marketo)).data) === null || _c === void 0 ? void 0 : _c.text()) : undefined;
    if (mjml) {
        bucketFiles.mjml = mjml;
    }
    if (mktomjml) {
        bucketFiles.mktomjml = mktomjml;
    }
    const html = await ((_d = (await downloadFile(projectName, 'html', marketo)).data) === null || _d === void 0 ? void 0 : _d.text());
    const mktohtml = marketo ? await ((_e = (await downloadFile(projectName, 'html', marketo)).data) === null || _e === void 0 ? void 0 : _e.text()) : undefined;
    if (html) {
        bucketFiles.html = html;
    }
    if (mktohtml) {
        bucketFiles.mktohtml = mktohtml;
    }
    return bucketFiles;
}
