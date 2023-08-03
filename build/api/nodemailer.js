import nodemailer from 'nodemailer';
export async function createTransporter(options) {
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
export async function mail(transporter, options) {
    const info = await transporter.sendMail({
        from: options.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
    });
    console.log("Message sent: %s", info.messageId);
}
;
