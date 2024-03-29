import nodemailer from 'nodemailer';
import { getState } from '../api/filesystem.js';
import { downloadFile } from '../api/supabase.js';
import { StorageError } from '@supabase/storage-js';

export async function downloadHTML(projectName: string, operationType: 'normal' | 'email', marketo?: boolean, emailName?: string): Promise<{data: Blob |null, error: StorageError | null}> {
  const { data, error } = await downloadFile(projectName, 'html', marketo, operationType, undefined, emailName);
  return { data, error };
}

export async function mailHTML(recipients: string[], htmlString: string) {

  // puxa save.json e salve user e password
  const state = await getState();

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
      from: `Mailer Tester ${state.id[0]}`,
      to: recipients,
      subject: "Mailer test",
      text: "This is a test generated by Mailer...",
      html: htmlString,
  });

  return info;
};