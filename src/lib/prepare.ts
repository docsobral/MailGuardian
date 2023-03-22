import chalk from 'chalk';
import mjml2html from 'mjml';
import { downloadFile } from '../api/supabase.js';

export async function downloadMJML(projectName: string) {
  try {
    const { data, error } = await downloadFile(projectName, 'mjml');
    if (error) {
      throw new Error('Failed to get MJML file! Check the project name or the project bucket');
    }
    return data
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
    process.exit(1);
  }
}

export type MJMLBuffer = Buffer;

export function parseMJML(mjmlBuffer: MJMLBuffer) {
  // regular parsing
  const mjmlString = mjmlBuffer.toString();
  const htmlString = mjml2html(mjmlString);
  return htmlString;
}