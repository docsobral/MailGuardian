import Enquirer from 'enquirer';

export enum PromptTypes {
  select = 'select',
  input = 'input',
  password = 'password',
  confirm = 'confirm',
}

export enum PromptMessages {
  id = 'Enter your email id: ',
  password = 'Enter your password: ',
  host = 'What is your email client?',
  confirm = 'Confirm: ',
  project = 'Enter the project\'s name: ',
  recipients = 'Enter the recipients: ',
}

export enum PromptNames {
  id = 'id',
  password = 'password',
  host = 'host',
  confirm = 'confirm',
  project = 'project',
  recipients = 'recipients',
}

export type PromptOptions = {
  type: PromptTypes;
  name: PromptNames;
  message: PromptMessages;
  choices?: ['Gmail', 'Apple', 'Outlook'];
  initial?: string;
}

export type PromptResults = {
  id?: string;
  password?: string;
  host?: string;
  confirm?: boolean;
  project?: string;
  recipients?: string[];
}

export async function enquire(options: PromptOptions[]): Promise<PromptResults> {
  return await Enquirer.prompt(options);
}