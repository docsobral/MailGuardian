import nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';

type EmailOptions = {
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html: string;
}

export type TransporterOptions = {
  'host': string;
  'id': string;
  'password': string;
}

export type TransporterType = nodemailer.Transporter<SMTPTransport.SentMessageInfo>

export async function createTransporter(options: TransporterOptions) {
  return nodemailer.createTransport({
    host: options.host,
    port: 587,
    secure: false,
    auth: {
      user: options.id,
      pass: options.password,
    },
  });
}

// send mail with defined transport object
export async function mail(transporter: TransporterType, options: EmailOptions) {
  const info = await transporter.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  console.log("Message sent: %s", info.messageId);
};