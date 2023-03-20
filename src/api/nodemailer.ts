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

export async function createTransporter(options: TransporterOptions, test = false) {
  if (test) {
    // Generate test SMTP service account from ethereal.email
    const testAccount = await nodemailer.createTestAccount();

    // create reusable transporter object using the default SMTP transport
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  } else {
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
}

// send mail with defined transport object
export async function mail(transporter: TransporterType, options: EmailOptions) {
  const info = await transporter.sendMail({
    from: options.from, // sender address
    to: options.to, // list of receivers
    subject: options.subject, // Subject line
    text: options.text, // plain text body
    html: options.html, // html body
  });

  console.log("Message sent: %s", info.messageId);
  // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

  // Preview only available when sending through an Ethereal account
  console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
};