import ora from 'ora';
import chalk from 'chalk';
import { readFileSync } from 'node:fs';
import { BucketError } from '../lib/error.js';
// import { Broadcaster } from './broadcaster.js';
import {
  __dirname,
  // getSession
} from './filesystem.js';
import {
  Database,
  Tables
} from '../types/database.types.js';
import { FileObject, StorageError } from '@supabase/storage-js';
import {
  createClient,
  // isAuthError,
  // Session
} from '@supabase/supabase-js';

type Config = {
  [config: string]: string;
}

const config: Config = JSON.parse(readFileSync(__dirname + 'config\\config.json', { encoding: 'utf8' }));

if (typeof config['SUPA_URL'] === 'undefined' || typeof config['SUPA_SECRET'] === 'undefined') {
  throw new Error(`${chalk.red('Missing API url, key or secret key! Please run \'mailer config\' to set them.')}`);
}

export type SupabaseStorageResult = {
  data: null | Blob | {message: string} | Pick<Bucket, 'name'> | {path: string} | FileObject[] | Bucket
  error: StorageError | null,
}

export type SupabaseDownloadResult = {
  data: Blob | null;
  error: null | StorageError;
}

// const options = { db: { schema: 'public' }, auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } };
const supabase = createClient<Database>(config['SUPA_URL'], config['SUPA_SECRET']);

export async function createBucket(bucketName: string) {
  let result: SupabaseStorageResult = await supabase.storage.createBucket(bucketName, { public: false });
  return result;
}

export async function deleteBucket(bucketName: string) {
  await supabase.storage.emptyBucket(bucketName);
  let result: SupabaseStorageResult = await supabase.storage.deleteBucket(bucketName);
  return result;
}

export async function cleanBucket(bucketName: string) {
  return await supabase.storage.emptyBucket(bucketName);
}

export async function uploadFile(file: string | Buffer, fileName: string, bucketName: string, contentType: 'text/plain' | 'image/png' = 'text/plain') {
  let result: SupabaseStorageResult = await supabase.storage.from(bucketName).upload(
    fileName,
    file,
    {contentType: contentType, upsert: true},
  );
  return result;
}

export async function updateFile(file: string | Buffer, fileName: string, bucketName: string, contentType: 'text/plain' | 'image/png' = 'text/plain') {
  let result: SupabaseStorageResult = await supabase.storage.from(bucketName).update(
    fileName,
    file,
    {contentType: contentType, upsert: false},
  );
  return result;
}

export async function listFiles(projectName: string) {
  return await supabase.storage.from(projectName).list();
}

export async function deleteFile(fileName: string, bucketName: string) {
  let result: SupabaseStorageResult = await supabase.storage.from(bucketName).remove([`${fileName}`]);
  return result;
}

export async function bucketExists(bucketName: string) {
  let result: SupabaseStorageResult = await supabase.storage.getBucket(bucketName);
  if (result.error) {
    throw new BucketError(`Bucket ${name} doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a template.`);
  }
  return result;
}

export async function downloadFile(bucketName: string, extension: 'mjml' | 'html' | 'png', marketo: boolean = false, imageName?: string): Promise<SupabaseDownloadResult> {
  const type = marketo ? 'marketo' : 'index';

  if (extension === 'mjml') {
    return await supabase.storage.from(bucketName).download(`${type}.mjml`);
  }

  else if (extension === 'html') {
    return await supabase.storage.from(bucketName).download(`${type}.html`);
  }

  else {
    return await supabase.storage.from(bucketName).download(`img/${imageName}`);
  }
}

export async function listImages(bucketName: string) {
  return await supabase.storage.from(bucketName).list('img', { sortBy: { column: 'name', order: 'asc' } });
}

export async function imagesUrls(bucketName: string, imageNames: string[]) {
  const pathList = imageNames.map(imageName => 'img/' + imageName);

  return supabase.storage.from(bucketName).createSignedUrls(pathList, 600);
}

export async function fileExists(name: string, list: any) {
  for (let index in list) {
    if (list[index].name === name) {
      return true
    }
  }

  return false
}

export async function listBuckets() {
  return await supabase.storage.listBuckets();
}

type Manager = typeof createBucket | typeof deleteBucket;

export async function manageBucket(name: string, type: 'create' | 'delete'): Promise<void> {
  let manager: Manager = type === 'create' ? createBucket : deleteBucket;

  function capitalizeFirstLetter(string: string): string {
    return `${string[0].toUpperCase() + string.slice(1)}`
  }

  process.stdout.write('\n');
  const spinner = ora(`${chalk.yellow(`Attempting to ${type} template named ${name}`)}`).start();
  const { error } = await manager(name);

  if (error) {
    spinner.fail();
    throw new BucketError(`\nFailed to ${type} template named ${name}!\n\n${error.stack?.slice(17)}`);
  }

  spinner.succeed(`${chalk.yellow(`${capitalizeFirstLetter(type)}d template named ${name}.`)}`);
}

// export async function newUser(email: string, password: string): Promise<Session> {
//   const { data, error } = await supabase.auth.signUp({ email, password });

//   if (isAuthError(error)) {
//     throw error;
//   }

//   return data.session as Session;
// }

// export async function refreshSession(session: Session): Promise<[Session, boolean]> {
//   const { data, error } = await supabase.auth.setSession(session);

//   if (isAuthError(error)) {
//     throw error;
//   }

//   let refreshed: boolean = false;

//   if (data.session?.refresh_token !== session.refresh_token) {
//     refreshed = true;
//   }

//   return [data.session as Session, refreshed];
// }

// export async function logIn(email: string, password: string): Promise<Session> {
//   const { data, error } = await supabase.auth.signInWithPassword({ email, password });

//   if (isAuthError(error)) {
//     throw error;
//   }

//   return data.session as Session;
// }

// export async function newBucket(name: string): Promise<void> {
//   if (!name) {
//     throw new BucketError(chalk.red('Set a name for the bucket!'));
//   }

//   if (await checkBucket(name)) {
//     throw new BucketError(chalk.red('This bucket already exists.'));
//   }

//   const uuid = getSession().user.id;

//   const { error } = await supabase.from('buckets').insert({
//     name,
//     created_by: uuid,
//   });

//   if (error) {
//     throw error;
//   }
// }

// export async function eraseBucket(name: string): Promise<void> {
//   if (!(await checkBucket(name))) {
//     throw new BucketError(chalk.red('This bucket doesn\'t exist.'));
//   }

//   const { error } = await supabase.from('buckets').delete().eq('name', name);

//   if (error) {
//     throw error;
//   }
// }

// export async function listAllBuckets(): Promise<string[]> {
//   let result: string[] = [];

//   const { data, error } = await supabase.from('buckets').select('name');

//   if (error) {
//     throw error;
//   }

//   for (const bucket of data) {
//     result.push(bucket.name);
//   }

//   return result;
// }

// export async function checkBucket(name: string): Promise<boolean> {
//   const buckets = await listAllBuckets();

//   if (buckets.includes(name)) {
//     return true;
//   }

//   return false;
// }

type Bucket = Partial<Tables<'buckets'>>;

// export async function getBucket(name: string): Promise<Bucket> {
//   if (!(await checkBucket(name))) {
//     throw new BucketError(chalk.red(`This bucket doesn't exist.`));
//   }

//   const { data, error } = await supabase.from('buckets').select().eq('name', name);

//   if (error) {
//     throw error;
//   }

//   const bucket = data[0];
//   return bucket;
// }

// export async function updateBucket(name: string, updates: Partial<Bucket>): Promise<void> {
//   if (!(await checkBucket(name))) {
//     throw new BucketError(chalk.red(`This bucket doesn't exist.`));
//   }

//   const { data: timestamp, error: functionError } = await supabase.rpc('get_timestamptz');

//   if (functionError) {
//     throw functionError;
//   }

//   updates.updated_at = timestamp;
//   updates.updated_by = getSession().user.id;

//   const { error: updateError } = await supabase.from('buckets').update(updates).eq('name', name);

//   if (updateError) {
//     throw updateError;
//   }
// }

// type DBBucketManagerOptions = {
//   create: boolean,
//   delete: boolean,
//   list: boolean
// };

// export async function manageDBBucket(name: string, options: DBBucketManagerOptions, broadcaster: Broadcaster): Promise<string[] | void> {
//   type Manager = typeof newBucket | typeof eraseBucket | typeof listAllBuckets;

//   let manager: Manager;

//   if (options.create) {
//     broadcaster.start(chalk.yellow(`Creating bucket named ${name}...`));
//     manager = newBucket;
//   }

//   else if (options.delete) {
//     broadcaster.start(chalk.yellow(`Deleting bucket named ${name}...`));
//     manager = eraseBucket;
//   }

//   else {
//     broadcaster.start(chalk.yellow(`Fetching list of buckets...`));
//     manager = listAllBuckets;
//   }

//   const result = await manager(name);

//   return result;
// }