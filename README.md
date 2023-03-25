# MJML Mailer

## About

This package was built with the purpose of serving as a quick means of proof testing email templates built with the MJML framework. Images should be PNG. It connects to a supabase API for hosting, where it will host the whole template like:

yourTemplate/\
├─ index.mjml\
├─ img/\
│ ├─ imageName.png\
│ ├─ imageName.png\
│ ├─ ...

It will only export templates with that folder structure and file names. Anything else will not work. Also, images src URLs on the mjml file must be local paths e.g. './img/imageName.png'. If they are different, the parser will not be able to replace local URLs with signed URLs generated by supabase.

## Commands

### login \<id\> \<password\>

The package uses Nodemailer to send mails. To that end, it needs valid credentials to work. For now, it only works with Gmail. If your gmail account uses 2FA, you will need to generate a app password on your security settings.

### bucket \[-c/-d/-l] \[name]

Creates or deletes a bucket or lists all buckets on supabase. Each bucket acts as a folder where each email template is stored. Bucket names should be easy to remember and relate to the template.

### export \<name\> \[path]

Exports a template's .mjml and .png files to a bucket. Path is optional on Windows only.

### prepare \[-m] \<name\>

Replaces all image URLs from local to remote paths with temporary URLs generated by supabase, and then parses MJML into HTML ready for mailing.

-m will parse it into a Marketo compatible HTML. Module tags and variables have to be added manually. Future support for custom MJML components is planned.

### mail \[-m] \<name\> \<recipients\>

Sends the template on a bucket to all recipients. Recipient list should be surrounded by quotation marks and separated by commas e.g. ', '.

## Usage

First, run `mailer`. You will be prompted for the supabase keys and URL. Then run `mailer login <your@email.adress> <yourpassword>` to connect to the email from which samples will be sent.

Each template should have its own folder, implemented on supabase as buckets. Create a bucket with `mailer bucket -c <bucketname>`. The name should preferably relate to the template. Then export the .mjml and .png files to the remote bucket with `mailer export <bucketname> [localpath]`. The path argument is optional. If you don't input a path, the app will open a folder select window where you can browse the filesystem for the folder where the template's files are located. The template folder MUST follow the example at [about](#about) for the export to work succesfully.

You can use `mailer parse <bucketname> [-m]` to parse the .MJML file into an HTML file that can then be sent over email.

The `-m` flag instructs the parser to create Adobe Marketo compatible HTML -- NOTICE: for now, the parser is only compatible with Marketo modules. The mktoName and id attributes must be manually filled (will be addressed in a future version). Editable elements (images, text) also have to be manually prepared (will be addressed in a future version).

To send a sample, use `mailer mail <bucketname> <"first@recipient.com, second@recipient.com, ...">` The `-m` flag will instruct the Marketo compatible html to be sent, if it exists.