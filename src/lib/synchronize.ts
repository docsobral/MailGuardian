import { downloadBucket, listBuckets, listFilesV2 } from '../api/supabase.js';
import { getChildDirectories } from '../api/filesystem.js';
import { Broadcaster } from '../api/broadcaster.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { __dirname } from '../api/filesystem.js';
import { resolve } from 'path';
import { manageBucket } from '../api/supabase.js';
import { FileObject } from '@supabase/storage-js';



type ExportMJML = (bucketName: string, type: 'templates' | 'components' | 'email', broadcaster?: Broadcaster, emailName?: string | undefined) => Promise<void>;



export async function handleSync(choice: string, broadcaster: Broadcaster, exportMJML: ExportMJML): Promise<void> {
  const command = (choice as string).match(/\s(\w+)$/);
  if (!command) {
    throw new Error('Error at handleSync when matching choice string');
  }

  console.log('command found:', command)

  if (choice.includes('All')) {
    await handleSyncAll(
      (command[1] as 'templates' | 'components' | 'tasks'),
      broadcaster,
      exportMJML,
    );
  }

  else if (choice.includes('Single')) {
    return;
  }

  else {
    throw new Error('Unknown error at handleSync');
  }
}



async function handleSyncAll(command: 'templates' | 'components' | 'tasks', broadcaster: Broadcaster, exportMJML: ExportMJML): Promise<void> {
  broadcaster.inform(`\nGetting remote ${command} buckets...`);

  const remoteBuckets = await listBuckets();
  if (remoteBuckets.error) throw new Error(remoteBuckets.error.stack);

  let relevantBuckets: string[] = [];
  let operationType: 'normal' | 'email' = 'normal';
  let bucketPrefix: '_VC-' | 'VT-' | 'VE-';
  let emailNames: string[] | FileObject[] = [];

  switch (command) {
    case 'components':
      bucketPrefix = '_VC-';
      break;

    case 'templates':
      bucketPrefix = 'VT-';
      break;

    case 'tasks':
      bucketPrefix = 'VE-';
      operationType = 'email';
      break;
  }

  relevantBuckets = remoteBuckets.data
  .filter(bucket => bucket.name.includes(bucketPrefix))
  .map(bucket => bucket.name);
  if (relevantBuckets.length === 0) throw new Error('Couldn\'t filter remote buckets');

  broadcaster.inform(`\nGetting local ${command} folders...`);
  const localFolders: string[] = getChildDirectories(resolve(__dirname, command));

  console.log('Local folders:', localFolders)

  broadcaster.inform(`\nComparing local and remote ${command}...`);
  const onlyRemoteBuckets = relevantBuckets.filter(bucket => !(localFolders.includes(bucket)));
  const onlyLocalFolders = localFolders.filter(folder => !(relevantBuckets.includes(folder)));

  console.log('Only remote:', onlyRemoteBuckets)
  console.log('Only local', onlyLocalFolders)

  // DOWNLOAD REMOTE BUCKETS
  for (const bucketName of onlyRemoteBuckets) {
    broadcaster.inform(`\nDownloading ${bucketName} from the server`);

    // GET LIST OF REMOTE EMAILS
    emailNames = await listFilesV2(bucketName);

    if (command === 'tasks') {
      for (const emailName of emailNames) {
        await fetchBucket(command, bucketName, operationType, emailName.name);
      }
    } else {
      await fetchBucket(command, bucketName, operationType);
    }
  }

  broadcaster.inform(`\nDone downloading ${command} from the server`);

  // UPLOAD LOCAL FOLDERS
  for (const folderName of onlyLocalFolders) {
    await manageBucket(folderName, 'create', broadcaster);

    if (command === 'tasks') emailNames = getChildDirectories(resolve(__dirname, 'tasks', folderName));

    if (emailNames.length > 0) {
      for (const emailName of emailNames) {
        await exportMJML(folderName, command === 'tasks' ? 'email' : command, broadcaster, (emailName as string));
      }
    } else {
      await exportMJML(folderName, command === 'tasks' ? 'email' : command, broadcaster);
    }
  }

  broadcaster.inform(`\nDone uploading ${command} to the server`);
}



async function fetchBucket(command: 'templates' | 'components' | 'tasks', bucketName: string, operationType: 'normal' | 'email', emailName?: string) {
  console.log(1)
  let newFolderPath = resolve(__dirname, command, bucketName);
  mkdirSync(resolve(newFolderPath, command === 'tasks' ? `${emailName}/img` : 'img'), { recursive: true });

  console.log(2)
  console.log('operation type:', operationType)
  console.log('email name:', emailName)
  const downloadedBucket = await downloadBucket(bucketName, operationType, emailName);

  console.log(3)
  const mjmlString = await downloadedBucket.MJML.text();
  const images: [Blob, string][] = downloadedBucket.images;

  if (command === 'tasks') newFolderPath = resolve(newFolderPath, (emailName as string));

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