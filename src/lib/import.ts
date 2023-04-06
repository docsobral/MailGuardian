import { downloadFile, listImages } from '../api/supabase.js';
import { StorageError } from '@supabase/storage-js';
import chalk from 'chalk';

export interface BucketFiles {
  images?: [string, Buffer][];
  mjml?: string;
  mktomjml?: string;
  html?: string;
  mktohtml?: string;
}

export async function importBucket(projectName: string, marketo: boolean = false): Promise<BucketFiles | StorageError> {
  let imgList: string[] = [];

  let bucketFiles: BucketFiles = {};
  let images: [string, Buffer][] = [];

  // get images
  // console.log(`${chalk.green('\nDownloading images...')}`);
  const fetch = await listImages(projectName);
  if (fetch.error) {
    return new StorageError(`${chalk.red('Download of the images failed!')}`);
  }

  fetch.data.forEach(fileObject => imgList.push(fileObject.name));

  for (let image of imgList) {
    const arrayBuffer = await (await downloadFile(projectName, 'png', undefined, image)).data?.arrayBuffer();
    if (arrayBuffer) {
      const tuple: [string, Buffer] = [image, Buffer.from(arrayBuffer)];
      images.push(tuple);
    }
  }

  bucketFiles.images = images;

  // get mjml
  // console.log(`${chalk.green('Downloading MJML...')}`);
  const mjml = await (await downloadFile(projectName, 'mjml')).data?.text();
  const mktomjml = marketo ? await (await downloadFile(projectName, 'mjml', marketo)).data?.text() : undefined;

  if (mjml) {
    bucketFiles.mjml = mjml;
  }

  if (mktomjml) {
    bucketFiles.mktomjml = mktomjml;
  }

  // if (marketo && typeof mktomjml === 'undefined' || !marketo && typeof mjml === 'undefined') {
  //   return new StorageError(`${chalk.red('Download of MJML failed!')}`);
  // }

  // get html
  // console.log(`${chalk.green('Downloading HTML...')}`);
  const html = await (await downloadFile(projectName, 'html', marketo)).data?.text();
  const mktohtml = marketo ? await (await downloadFile(projectName, 'html', marketo)).data?.text() : undefined;

  if (html) {
    bucketFiles.html = html;
  }

  if (mktohtml) {
    bucketFiles.mktohtml = mktohtml;
  }

  // if (marketo && typeof mktohtml === 'undefined' || !marketo && typeof html === 'undefined') {
  //   return new StorageError(`${chalk.red('Download of HTML failed!')}`);
  // }

  return bucketFiles;
}