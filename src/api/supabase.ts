import chalk from 'chalk';
import env from './dotenv.js';
import { createClient } from '@supabase/supabase-js';
import { Bucket, FileObject, StorageError } from '@supabase/storage-js';

if (typeof env.supaUrl === 'undefined' || typeof env.supaKey === 'undefined' || typeof env.supaSecret === 'undefined') {
  console.log(`${chalk.red('Missing API url, key or secret key!')}`);
  process.exit(1);
}

export type SupabaseStorageResult = {
  data: null | Blob | {message: string} | Pick<Bucket, 'name'> | {path: string} | FileObject[] | Bucket
  error: StorageError | null,
}

export type SupabaseDownloadResult = {
  data: Blob | null;
  error: null | StorageError;
}

// inicia um cliente supabase para usar funções
const options = { db: { schema: 'public' }, auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } };
const supabase = createClient(env.supaUrl, env.supaSecret, options);

// cria bucket
export async function createFolder(projectName: string) {
  let result: SupabaseStorageResult;
  return result = await supabase.storage.createBucket(projectName, { public: false });
}

// deleta bucket
export async function deleteFolder(projectName: string) {
  await supabase.storage.emptyBucket(projectName);
  let result: SupabaseStorageResult;
  return result = await supabase.storage.deleteBucket(projectName);
}

export async function cleanFolder(projectName: string) {
  let result: SupabaseStorageResult;
  return result = await supabase.storage.emptyBucket(projectName);
}

// sobe arquivo para pasta específica dentro de bucket do projeto
export async function uploadFile(file: string | Buffer, fileName: string, projectName: string, contentType: 'text/plain' | 'image/png' = 'text/plain') {
  let result: SupabaseStorageResult = await supabase.storage.from(projectName).upload(
    fileName,
    file,
    {contentType: contentType, upsert: false},
  );
  return result;
}

export async function updateFile(file: string | Buffer, fileName: string, projectName: string, contentType: string) {
  let result: SupabaseStorageResult = await supabase.storage.from(projectName).update(
    fileName,
    file,
    {contentType: contentType, upsert: false},
  );
  return result;
}

export async function deleteFile(fileName: string, projectName: string) {
  let result: SupabaseStorageResult;
  return result = await supabase.storage.from(projectName).remove([`${fileName}`]);
}

// checa se bucket existe
export async function folderExists(projectName: string) {
  let result: SupabaseStorageResult;
  return result = await supabase.storage.getBucket(projectName);
}

export async function downloadFile(projectName: string, extension: 'mjml' | 'html' | 'png', type?: 'index' | 'marketo', imageName?: string): Promise<SupabaseDownloadResult> {
  if (extension === 'mjml') {
    return await supabase.storage.from(projectName).download('index.mjml');
  }

  if (extension === 'html') {
    return await supabase.storage.from(projectName).download(`${type}.html`);
  }

  return await supabase.storage.from(projectName).download(`img/${imageName}.png`)
}

export async function listImages(projectName: string) {
  return await supabase.storage.from(projectName).list('img', { sortBy: { column: 'name', order: 'asc' } });
}

export async function imagesUrls(projectName: string, imageNames: string[]) {
  const pathList = imageNames.map(imageName => 'img/' + imageName);

  return supabase.storage.from(projectName).createSignedUrls(pathList, 600);
}