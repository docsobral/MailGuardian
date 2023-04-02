import Enquirer from 'enquirer';

export enum EnquireTypes {
  select = 'select',
  input = 'input',
  confirm = 'confirm',
}

export enum EnquireMessages {
  confirm = 'Confirm: ',
  project = 'Enter the project\'s name: ',
  recipients = 'Enter the recipients: ',
  supabaseKey = 'Enter the supabase key: ',
  supabaseSecret = 'Enter the supabase secret key: ',
  supabaseURL = 'Enter the supabase URL: ',
  secretKey = 'Enter a secret key that will be used to encrypt your credentials: ',
}

export enum EnquireNames {
  confirm = 'confirm',
  project = 'project',
  recipients = 'recipients',
  supabaseKey = 'supabaseKey',
  supabaseSecret = 'supabaseSecret',
  supabaseURL = 'supabaseURL',
  secretKey = 'secretKey',
}

export type EnquireOptions = {
  type: EnquireTypes;
  name: EnquireNames;
  message: EnquireMessages;
  initial?: string;
}

export type EnquireResults = {
  confirm?: boolean;
  project?: string;
  recipients?: string[];
  supabaseKey?: string;
  supabaseSecret?: string;
  supabaseURL?: string;
  secretKey?: string;
}

export async function enquire(options: EnquireOptions[]): Promise<EnquireResults> {
  return await Enquirer.prompt(options);
}