import { readFileSync } from 'node:fs';
import { __dirname } from './filesystem.js';
import { BucketError } from '../lib/error.js';
import { createClient } from '@supabase/supabase-js';
import { Database, Tables } from '../types/database.types.js';
import { FileObject, StorageError } from '@supabase/storage-js';
import { resolve } from 'path';

type Config = {
  [config: string]: string;
}

const config: Config = JSON.parse(readFileSync(resolve(__dirname, 'config/config.json'), { encoding: 'utf8' }));

if (typeof config['SUPA_URL'] === 'undefined' || typeof config['SUPA_SECRET'] === 'undefined') {
  throw new Error('Missing API url, key or secret key! Please run \'mailer config\' to set them.');
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
export const supabase = createClient<Database>(config['SUPA_URL'], config['SUPA_SECRET']);

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

export async function listImagesV2 (bucketName: string) {
  const result = await supabase.storage.from(bucketName).list('img', { sortBy: { column: 'name', order: 'asc' } });

  if (result.error) {
    throw result.error;
  }

  return result.data.map(image => image.name);
}

export async function imagesUrls(bucketName: string, imageNames: string[]) {
  const pathList = imageNames.map(imageName => 'img/' + imageName);

  return supabase.storage.from(bucketName).createSignedUrls(pathList, 86400);
}

export async function imagesUrlsV2(bucketName: string, imageList: string[]) {
  const pathList: string[] = imageList.map(imageName => resolve('img', imageName));
  const result = await supabase.storage.from(bucketName).createSignedUrls(pathList, 1200);

  if (result.error) {
    throw result.error;
  }

  return result.data.map(url => url.signedUrl);
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

export async function manageBucket(name: string, type: 'create' | 'delete', broadcaster: any): Promise<void> {
  let manager: Manager = type === 'create' ? createBucket : deleteBucket;

  function capitalizeFirstLetter(string: string): string {
    return `${string[0].toUpperCase() + string.slice(1)}`
  }

  broadcaster.start(`Attempting to ${type} bucket named ${name}`);
  const { error } = await manager(name);

  if (error) {
    broadcaster.fail();
    throw new BucketError(`\nFailed to ${type} bucket named ${name}!\n\n${error.stack?.slice(17)}`);
  }

  broadcaster.succeed(`${capitalizeFirstLetter(type)}d template named ${name}.`);
}

type Bucket = Partial<Tables<'buckets'>>;