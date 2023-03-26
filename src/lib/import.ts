import { downloadFile, listImages } from '../api/supabase.js';
import chalk from 'chalk';

interface BucketFiles {
  images?: [string, Buffer][];
  mjml?: string;
  index?: string;
  marketo?: string;
}

export async function importBucket(projectName: string, marketo: boolean = false): Promise<BucketFiles> {
  let imgList: string[] = [];

  let bucketFiles: BucketFiles = {};
  let images: [string, Buffer][] = [];

  try {
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

  // NOT WORKING
  for (let image of imgList) {
    const arrayBuffer = await (await downloadFile(projectName, 'png', undefined, image)).data?.arrayBuffer();
    if (arrayBuffer) {
      const tuple: [string, Buffer] = [image, Buffer.from(arrayBuffer)];
      images.push(tuple);
    }
  }

  bucketFiles.images = images;

  try {
    console.log(`${chalk.yellow('\nDownloading index.mjml')}`)
    const download = await (await downloadFile(projectName, 'mjml')).data?.text();
    if (download) {
      bucketFiles.mjml = download;
    }

    else {
      throw new Error('Couldn\'t download the MJML file. Does it exist in the bucket?')
    }
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
  }

  // get html
  if (!marketo) {
    try {
      console.log(`${chalk.yellow('Downloading index.html')}`)
      const download = await (await downloadFile(projectName, 'html')).data?.text();
      if (download) {
        bucketFiles.index = download;
      }

      else {
        throw new Error('Couldn\'t download the HTML file. Does it exist in the bucket?')
      }
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
    }
  }

  // get marketo html
  if (marketo) {
    try {
        console.log(`${chalk.yellow('Downloading marketo.html')}`)
        const download = await (await downloadFile(projectName, 'html', 'marketo')).data?.text();
        if (download) {
          bucketFiles.marketo = download;
        }

        else {
          throw new Error('Couldn\'t download the Marketo HTML. Does it exist in the bucket?')
        }
    }

    catch (error) {
      console.error(`${chalk.red(error)}`);
    }
  }

  return bucketFiles;
}