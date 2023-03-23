import Enquirer from 'enquirer';

export enum PromptTypes {
  select = 'select',
  input = 'input',
  confirm = 'confirm',
}

export enum PromptMessages {
  confirm = 'Confirm: ',
  project = 'Enter the project\'s name: ',
  recipients = 'Enter the recipients: ',
  supabaseKey = 'Enter the supabase key: ',
  supabaseSecret = 'Enter the supabase secret key: ',
  supabaseURL = 'Enter the supabase URL: ',
  secretKey = 'Enter a secret key that will be used to encrypt your credentials: ',
}

export enum PromptNames {
  confirm = 'confirm',
  project = 'project',
  recipients = 'recipients',
  supabaseKey = 'supabaseKey',
  supabaseSecret = 'supabaseSecret',
  supabaseURL = 'supabaseURL',
  secretKey = 'secretKey',
}

export type PromptOptions = {
  type: PromptTypes;
  name: PromptNames;
  message: PromptMessages;
  initial?: string;
}

export type PromptResults = {
  confirm?: boolean;
  project?: string;
  recipients?: string[];
  supabaseKey?: string;
  supabaseSecret?: string;
  supabaseURL?: string;
  secretKey?: string;
}

export async function enquire(options: PromptOptions[]): Promise<PromptResults> {
  return await Enquirer.prompt(options);
}