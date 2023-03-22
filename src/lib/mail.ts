import chalk from 'chalk';
import nodemailer from 'nodemailer';
import { getState } from './save.js';
import { downloadFile } from '../api/supabase.js';

export async function downloadHTML(projectName: string): Promise<Blob | null> {
  try {
    const { data, error } = await downloadFile(projectName, 'html', 'index');
    if (error) {
      throw new Error('Failed to get HTML file! Check the project name or the project bucket');
    }
    return data
  }

  catch (error) {
    console.error(`${chalk.red(error)}`);
    process.exit(1);
  }
}

export async function mailHTML(recipients: string[], htmlString: string) {

  // puxa save.json e salve user e password
  const state = getState();

  // create reusable transporter object
  const Transporter = nodemailer.createTransport({
      // @ts-ignore
      host: state.host[0],
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
          user: state.id[0],
          pass: state.password[0],
      },
  });

  let info = await Transporter.sendMail({
      // @ts-ignore
      from: state.id[0], // sender address
      to: recipients, // list of receivers
      subject: "Mailer test ✔", // Subject line
      text: "This is a test.", // plain text body
      html: htmlString, // html body
  });

  return info;
};