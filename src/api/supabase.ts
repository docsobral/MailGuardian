import chalk from 'chalk';
import env from './dotenv.js';
import { readFileSync } from 'node:fs';
import { StorageError } from '@supabase/storage-js';
import { createClient } from '@supabase/supabase-js';

if (typeof env.supaUrl === 'undefined' || typeof env.supaKey === 'undefined' || typeof env.supaSecret === 'undefined') {
  console.log(`${chalk.red('Missing API url, key or secret key!')}`);
  process.exit(1);
}

export type SupabaseStorageResult = {
  data: unknown,
  error: StorageError | null,
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
export async function uploadFile(filePath: string, fileName: string, projectName: string, contentType: string) {
  const file = readFileSync(filePath);
  let result: SupabaseStorageResult = await supabase.storage.from(projectName).upload(
    fileName,
    file,
    {contentType: contentType, upsert: false},
  );
  return result;
}

export async function updateFile(filePath: string, fileName: string, projectName: string, contentType: string) {
  const file = readFileSync(filePath);
  let result: SupabaseStorageResult;
  result = await supabase.storage.from(projectName).update(
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