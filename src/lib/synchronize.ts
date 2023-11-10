import { downloadBucket, listBuckets } from "../api/supabase.js";
import { getChildDirectories } from "../api/filesystem.js";
import { Broadcaster } from "../api/broadcaster.js";
import { mkdirSync, writeFileSync } from 'node:fs';
import { __dirname } from "../api/filesystem.js";
import { resolve } from 'path';

export async function handleSync(choice: string, broadcaster: Broadcaster): Promise<void> {
  const command = (choice as string).match(/\s(\w+)$/);
  if (!command) {
    throw new Error('Error at handleSync when matching choice string');
  }

  console.log('command found:', command)

  if (choice.includes('All')) {
    return await handleSyncAll(
      (command[1] as 'templates' | 'components' | 'tasks'),
      broadcaster
    );
  }

  else if (choice.includes('Single')) {
    return;
  }

  else {
    throw new Error('Unknown error at handleSync');
  }
}

export async function handleSyncAll(command: 'templates' | 'components' | 'tasks', broadcaster: Broadcaster): Promise<void> {
  broadcaster.inform(`\nGetting remote ${command} buckets...`);

  const remoteBuckets = await listBuckets();
  if (remoteBuckets.error) throw new Error(remoteBuckets.error.stack);

  let relevantBuckets: string[] = [];
  let operationType: 'normal' | 'email' = 'normal';

  switch (command) {
    case 'components':
      relevantBuckets = remoteBuckets.data
      .filter(bucket => bucket.name.includes('_VC-'))
      .map(bucket => bucket.name);
      break;

    case 'templates':
      relevantBuckets = remoteBuckets.data
      .filter(bucket => bucket.name.includes('VT'))
      .map(bucket => bucket.name);
      break;
  }

  if (relevantBuckets.length === 0) throw new Error('Couldn\'t filter remote buckets');

  broadcaster.inform(`\nGetting local ${command} folders...`);

  const localFolders: string[] = getChildDirectories(resolve(__dirname, command));

  broadcaster.inform(`\nComparing local and remote ${command}...`);

  const onlyRemoteBuckets = relevantBuckets.filter(bucket => !(localFolders.includes(bucket)));
  const onlyLocalFolders = localFolders.filter(folder => !(relevantBuckets.includes(folder)));

  console.log('Only remote:', onlyRemoteBuckets)
  console.log('Only local', onlyLocalFolders)

  for (const bucket of onlyRemoteBuckets) {
    broadcaster.inform(`\nDownloading ${bucket} from the server`);
    await fetchBucket(command, bucket, operationType);
  }

  broadcaster.inform(`\nDone downloading ${command} from the server`);

  for (const folder of onlyLocalFolders) {
    // await manageBucket(component, 'create', this.caster);
    // await this.exportMJML(component, 'components');
  }

  broadcaster.inform(`\nDone uploading ${command} to the server`);
}

async function fetchBucket(command: 'templates' | 'components' | 'tasks', bucketName: string, operationType: 'normal' | 'email') {
  const newFolderPath = resolve(__dirname, command, bucketName);
  mkdirSync(resolve(newFolderPath, 'img'), { recursive: true });

  const downloadedBucket = (await downloadBucket(bucketName, operationType));

  const mjmlString = await downloadedBucket.MJML.text();
  const images: [Blob, string][] = downloadedBucket.images;

  writeFileSync(resolve(newFolderPath, 'index.mjml'), mjmlString);

  for (let image of images) {
    const imageBlob = image[0];
    const imageName = image[1];

    const imageArrayBuffer = await imageBlob.arrayBuffer();
    const imageBuffer = Buffer.from(imageArrayBuffer);

    writeFileSync(resolve(newFolderPath, `img/${imageName}`), imageBuffer);
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
