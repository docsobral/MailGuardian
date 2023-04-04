import { downloadFile, listImages } from '../api/supabase.js';
import chalk from 'chalk';

interface BucketFiles {
  images?: [string, Buffer][];
  mjml?: string;
  mktomjml?: string;
  html?: string;
  mktohtml?: string;
}

export async function importBucket(projectName: string, marketo: boolean = false): Promise<BucketFiles> {
  let imgList: string[] = [];

  let bucketFiles: BucketFiles = {};
  let images: [string, Buffer][] = [];

  // get images
  try {
    console.log(`${chalk.green('\nDownloading images...')}`);
    const fetch = await listImages(projectName);
    if (fetch.error) {
      throw new Error('Failed to fetch list of image names!');
    }

    fetch.data.forEach(fileObject => imgList.push(fileObject.name));
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
    process.exit(1);
  }

  for (let image of imgList) {
    const arrayBuffer = await (await downloadFile(projectName, 'png', undefined, image)).data?.arrayBuffer();
    if (arrayBuffer) {
      const tuple: [string, Buffer] = [image, Buffer.from(arrayBuffer)];
      images.push(tuple);
    }
  }

  bucketFiles.images = images;

  // get mjml
  try {
    console.log(`${chalk.green('Downloading MJML...')}`);
    const mjml = await (await downloadFile(projectName, 'mjml')).data?.text();
    const mktomjml = marketo ? await (await downloadFile(projectName, 'mjml', marketo)).data?.text() : undefined;

    if (mjml) {
      bucketFiles.mjml = mjml;
    }

    if (mktomjml) {
      bucketFiles.mktomjml = mktomjml;
    }

    else {
      throw new Error('Download of MJML failed!');
    }
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
  }

  // get html
  try {
    console.log(`${chalk.green('Downloading HTML...')}`);
    const html = await (await downloadFile(projectName, 'html', marketo)).data?.text();
    const mktohtml = marketo ? await (await downloadFile(projectName, 'html', marketo)).data?.text() : undefined;

    if (html) {
      bucketFiles.html = html;
    }

    if (mktohtml) {
      bucketFiles.mktohtml = mktohtml;
    }

    else {
      throw new Error('Download of HTML failed!');
    }
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
  }

  return bucketFiles;
}