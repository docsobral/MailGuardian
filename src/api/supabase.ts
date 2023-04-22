import chalk from 'chalk';
import { readFileSync } from 'node:fs';
import { __dirname } from './filesystem.js';
import { BucketError } from '../lib/error.js';
import { createClient } from '@supabase/supabase-js';
import { Bucket, FileObject, StorageError } from '@supabase/storage-js';

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

const options = { db: { schema: 'public' }, auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } };
const supabase = createClient(config['SUPA_URL'], config['SUPA_SECRET'], options);

export async function createBucket(projectName: string) {
  let result: SupabaseStorageResult = await supabase.storage.createBucket(projectName, { public: false });
  return result;
}

export async function deleteBucket(projectName: string) {
  await supabase.storage.emptyBucket(projectName);
  let result: SupabaseStorageResult = await supabase.storage.deleteBucket(projectName);
  return result;
}

export async function cleanBucket(projectName: string) {
  return await supabase.storage.emptyBucket(projectName);
}

export async function uploadFile(file: string | Buffer, fileName: string, projectName: string, contentType: 'text/plain' | 'image/png' = 'text/plain') {
  let result: SupabaseStorageResult = await supabase.storage.from(projectName).upload(
    fileName,
    file,
    {contentType: contentType, upsert: true},
  );
  return result;
}

export async function updateFile(file: string | Buffer, fileName: string, projectName: string, contentType: 'text/plain' | 'image/png' = 'text/plain') {
  let result: SupabaseStorageResult = await supabase.storage.from(projectName).update(
    fileName,
    file,
    {contentType: contentType, upsert: false},
  );
  return result;
}

export async function listFiles(projectName: string) {
  return await supabase.storage.from(projectName).list();
}

export async function deleteFile(fileName: string, projectName: string) {
  let result: SupabaseStorageResult = await supabase.storage.from(projectName).remove([`${fileName}`]);
  return result;
}

export async function bucketExists(projectName: string) {
  let result: SupabaseStorageResult = await supabase.storage.getBucket(projectName);
  if (result.error) {
    throw new BucketError(`Bucket ${name} doesn\'t exist! Use \'mailer bucket -c [name]\' to create one before trying to export a template.`);
  }
  return result;
}

export async function downloadFile(projectName: string, extension: 'mjml' | 'html' | 'png', marketo: boolean = false, imageName?: string): Promise<SupabaseDownloadResult> {
  const type = marketo ? 'marketo' : 'index';

  if (extension === 'mjml') {
    return await supabase.storage.from(projectName).download(`${type}.mjml`);
  }

  else if (extension === 'html') {
    return await supabase.storage.from(projectName).download(`${type}.html`);
  }

  else {
    return await supabase.storage.from(projectName).download(`img/${imageName}`);
  }
}

export async function listImages(projectName: string) {
  return await supabase.storage.from(projectName).list('img', { sortBy: { column: 'name', order: 'asc' } });
}

export async function imagesUrls(projectName: string, imageNames: string[]) {
  const pathList = imageNames.map(imageName => 'img/' + imageName);

  return supabase.storage.from(projectName).createSignedUrls(pathList, 600);
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