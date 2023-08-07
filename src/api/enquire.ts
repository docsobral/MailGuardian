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
  addLabel = 'Do you want to add a label to this anchor?',
  label = 'Enter the label: ',
}

export enum EnquireNames {
  confirm = 'confirm',
  project = 'project',
  recipients = 'recipients',
  supabaseKey = 'supabaseKey',
  supabaseSecret = 'supabaseSecret',
  supabaseURL = 'supabaseURL',
  secretKey = 'secretKey',
  addLabel = 'addLabel',
  label = 'label',
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
  addLabel?: boolean;
  label?: string;
}

export async function enquire(options: EnquireOptions[]): Promise<EnquireResults> {
  return await Enquirer.prompt(options);
}