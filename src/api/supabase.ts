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

export type DownloadedBucket = {
  MJML: Blob,
  images: [Blob, string][],
}

// const options = { db: { schema: 'public' }, auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } };
export const supabase = createClient<Database>(config['SUPA_URL'], config['SUPA_SECRET']);

export async function createBucket(bucketName: string) {
  let result: SupabaseStorageResult = await supabase.storage.createBucket(bucketName, { public: false });
  return result;
}

export async function deleteBucket(bucketName: string) {
  const emptyResult = await supabase.storage.emptyBucket(bucketName);
  if (emptyResult.error) throw emptyResult.error;

  let deleteResult: SupabaseStorageResult = await supabase.storage.deleteBucket(bucketName);
  return deleteResult;
}

export async function cleanBucket(bucketName: string) {
  try {
    return await supabase.storage.emptyBucket(bucketName);
  } catch(error) {
    throw error;
  }
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
    return false
  }
  return true;
}

export async function downloadFile(bucketName: string, extension: 'mjml' | 'html' | 'png', marketo: boolean = false, operationType: 'normal' | 'email', imageName?: string, emailName?: string): Promise<SupabaseDownloadResult> {
  const MJMLType = marketo ? 'marketo' : 'index';

  let path: string = '';

  if (operationType === 'email') path = `${emailName}/${MJMLType}.${extension}`;
  else path = `${MJMLType}.${extension}`;

  if (extension === 'mjml') {
    return await supabase.storage.from(bucketName).download(path);
  }

  else if (extension === 'html') {
    return await supabase.storage.from(bucketName).download(path);
  }

  else {
    return await supabase.storage.from(bucketName).download(`${operationType === 'email' ? emailName + '/' : null}img/${imageName}`);
  }
}

export async function downloadMJML(bucketName: string, operationType: 'normal' | 'email', emailName?: string): Promise<Blob> {
  let path: string = '';

  if (operationType === 'email') path = `${emailName}/index.mjml`;
  else path = 'index.mjml';

  try {
    const mjml = await downloadFile(bucketName, 'mjml', false, operationType, undefined, emailName);

    if (mjml.error) throw mjml.error;

    else if (mjml.data == null) throw new Error('Unknown error when downloading MJML file');

    return mjml.data;
  }

  catch (error) {
    throw error;
  }
}

export async function downloadBucket(bucketName: string, operationType: 'normal' | 'email', emailName?: string): Promise<DownloadedBucket> {
  const MJML = await downloadMJML(bucketName, operationType, emailName);
  const images = await downloadImages(bucketName, operationType);

  return { MJML, images };
}

export async function listImages(bucketName: string) {
  return await supabase.storage.from(bucketName).list('img', { sortBy: { column: 'name', order: 'asc' } });
}

export async function listImagesV2 (bucketName: string, operationType: 'normal' | 'email', emailName?: string) {
  const path = operationType === 'email' ? emailName + '/img' : 'img';
  const result = await supabase.storage.from(bucketName).list(path, { sortBy: { column: 'name', order: 'asc' } });

  if (result.error) {
    throw result.error;
  }

  return result.data.map(image => image.name);
}

export async function downloadImages(bucketName: string, operationType: 'normal' | 'email', emailName?: string): Promise<[Blob, string][]> {
  const imageNames = await listImagesV2(bucketName, operationType, emailName);

  console.log(imageNames)

  let images: [Blob, string][] = [];

  for (const imageName of imageNames) {
    const image = await supabase.storage.from(bucketName).download(`img/${imageName}`);

    if (image.error) throw image.error;
    if (image.data === null) throw new Error(`Unknown error when downloading image ${imageName}`);

    images.push([image.data, imageName]);
  }

  return images;
}

export async function imagesUrls(bucketName: string, imageNames: string[], operationType?: 'normal' | 'email', emailName?: string) {
  const pathList = imageNames.map(imageName => {
    const path = operationType === 'email' ? emailName + '/img/' : 'img/';
    return path + imageName;
  });

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

export async function listFilesV2(bucketName: string): Promise<FileObject[]> {
  const { data, error } = await supabase.storage.from(bucketName).list();

  if (error) {
    throw error;
  }

  return data;
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

  broadcaster.succeed(`${capitalizeFirstLetter(type)}d bucket named ${name}.`);
}

type Bucket = Partial<Tables<'buckets'>>;

export function isBucket(value: any): value is Bucket {
  return typeof (value as Bucket).id != null;
}