import chalk from 'chalk';
import env from './dotenv.js';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

if (typeof env.supaUrl === 'undefined' || typeof env.supaKey === 'undefined' || typeof env.supaSecret === 'undefined') {
  console.log(`${chalk.red('Missing API url, key or secret key!')}`);
  process.exit(1);
}

// inicia um cliente supabase para usar funções
const options = { db: { schema: 'public' }, auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } };
const supabase = createClient(env.supaUrl, env.supaSecret, options);

// cria bucket
export async function createFolder(projectName: string) {
  return supabase.storage.createBucket(projectName, { public: false });
}

// deleta bucket
export async function deleteFolder(projectName: string) {
  await supabase.storage.emptyBucket(projectName);
  return supabase.storage.deleteBucket(projectName);
}

// sobe arquivo para pasta específica dentro de bucket do projeto
export async function uploadFile(filePath: string, fileName: string, projectName: string, contentType: string) {
  const file = readFileSync(filePath);
  try {
    const { data, error } = await supabase.storage.from(projectName).upload(
      fileName,
      file,
      {contentType: contentType, upsert: false},
    );
    console.log(`${chalk.green(`Uploading ${fileName}`)}`);

    if (error) {
      throw new Error(error.toString());
    }
  } catch (error) {
    console.log(`${chalk.red('Something went wrong:', error)}`);
  }
}

export async function updateFile(filePath: string, fileName: string, projectName: string, contentType: string) {
  const file = readFileSync(filePath)
  await supabase.storage.from(projectName).update(
    fileName,
    file,
    {contentType: contentType, upsert: false},
  );

  console.log(`${chalk.green(`Updating ${fileName}`)}`);
}

export async function deleteFile(fileName: string, projectName: string) {
  await supabase.storage.from(projectName).remove([`${fileName}`]);
}