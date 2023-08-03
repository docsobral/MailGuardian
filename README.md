# MJML Mailer

## About

This tool was built with the initial purpose of serving as a quick means of proof testing email templates built with the MJML framework. Eventually it grew to be more than that, and it's taking the shape of a suite for testing and compiling emails. You can send email samples, build and store templates, build components, test for spam score and compile MJML emails into regular HTML or Marketo compatible HTML.

## Instalation

MailGuardian was made and tested with TypeScript v5.0.2 and Node v18.12.0. Your mileage may vary depending on the version you have installed.

Install [Docker](https://www.docker.com/). Then clone this repository, `cd` into it, and run `npm install` to install all dependencies. Run `tsc` once, so that all TypeScript is compiled into a new folder called `build`. From this point on, MailGuardian is ready to run.

If you want to be able to run MailGuardian globally, run `npm install -g`. This will create a reference to `./build/bin/index.js` to your PATH.

## Requirements for exporting an email/template to Supabase

Images should be PNG. Your template should be in a directory arranged the following way:

yourTemplate/\
├─ index.mjml\
├─ marketo*.mjml\
├─ img/\
│ ├─ imageName.png\
│ ├─ imageName.png\
│ ├─ ...

It will only export templates with that folder structure and file names. Anything else will not work. MailGuardian's parser is programmed to find local paths in all `<mj-image>` tags. It will compare the paths to the image names it finds in the img folder, and then replace those local paths for remote paths generated on demand upon running `mailer prepare`.

## Requirements for Marketo MJML

 ***ALL top elements in the MJML file (`<mj-section>` or `<mj-wrapper>`) MUST have a `css-class` attribute. That is how the Marketo modules are going to be named. Try using a name descriptive of the function of the section/wrapper.***

 ***All lateral padding (that is, left and right padding) of top elements (`<mj-section>` or `<mj-wrapper>`), MUST be fixed. Variables are NOT allowed as values for top elements. Blame it on Outlook.***

Marketo variables can be used with the MJML, and they will be parsed for Marketo. The required syntax is as follows, and **MUST** be followed:

**Text variable:** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`${text: variableName; default: Text with spaces and no quotation marks!}`\
**Number variable:** `${number: variableName; default: 10}` **(ONLY NUMBERS)**\
**Color variable:** &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`${color: variableName; default: #FFFFFF}` **(ONLY HEX COLORS)**
<!-- **HTML variable:** ${html: NAME; default: <html>something</html>} (ONLY HTML) -->

The name value *MUST* be a single word. Camel case is not mandatory. Single quotes are optional around name and default values. Double quotes are ***FORBIDDEN*** to avoid conflict with the HTML. All following examples are valid Marketo variables and will be correctly parsed by Mailer:

```
${text: fontWeight; default: bold}</code>
${text: textAlignment; default: 'left'}
${color: 'bgColor'; default: '#F7F7F7'}
${number:  'name'  ; '20'  }
${number:   name    ;  20   }
```

The last two examples are meant to demonstrate that whitespaces before and after the name and default values or before and after the semi-colon will be trimmed. Whitespace before the name attribute (text, color, number) is not allowed:

`${   text: 'someName'; default: 'some text'}`

The above variable is invalid. Even though the rest of the variable is valid, the whitespace between '${' and 'text' renders it invalid.

It is preferable that you just follow the regular `${text: coolName; default: someText}` with no whitespaces and quotation marks.

<br>

e.g.:
```
<mj-column
  background-color="${color: columnBgColor; default: #F2F2F2}"
  padding="0px ${number: columnHPadding; default: 10}px">
  ***CHILDREN***
</mj-column>
```

<br>

The default field is **NOT** optional. The default field of a text variable can be filled with any kind of text, whitespace and most special characters. It can be wrapped by single quotes. Whitespace before and after the start of the text will be trimmed.

Remember to follow the template correctly.

## Commands

### save-credentials \<id\> \<password\>

The package uses Nodemailer to send mails. To that end, it needs valid credentials to work. For now, it only works with Gmail. If your gmail account uses 2FA, you will need to generate a app password on your security settings.

### template \[name] \[-c/-d/-l] \[components]

Creates or deletes a new template or lists all templates on Supabase. MailGuardian will also create a bucket on Supabase with the same name. Each bucket acts as a folder where each email template can be stored remotely. You will need to export the template to the bucket if you want to use MailGuardian's HTML generating and proofing functions.

`-c or --create` creates a template.

`-d or --delete` deletes a template (and all files in it).

`-l or --list` lists all buckets in Supabase.

You can list one or more component that you want to import directly into the new template, like `mailer template someName -c 'component1, component2, component3'`.

### component \[name] \[-c/d]

Creates or deletes a new component. This component's body and styles can then be imported when creating a new template. Mind the style guide when writing the components styles, so that they are properly read by the parser.

### export \<name\> \[-w/-n/-i/-c/-m] \[path]

Exports a template's .mjml and .png files to a bucket. Path is optional on Windows only.

`-w or --watch` will keep watching the folder's index.mjml for changes. **WARNING**: this functionality is currently broken

`-n or --new-path` use this flag when exporting a template for the first time.

`-i or --images` will skip uploading images.

`-c or --clean` will clean the bucket before uploading any file.

`-m or --marketo` will upload marketo.mjml to the bucket.

### prepare \<name\> \[-m]

Replaces all image URLs from local to remote paths with temporary URLs generated by supabase, and then parses MJML into HTML ready for mailing.

`-m or --marketo` will parse it into a Marketo compatible HTML. Module tags and variables have to be added manually. Future support for custom MJML components is planned.

### send \<name\> \[-m] \<recipients\>

Sends the template on a bucket to all recipients. Recipient list should be surrounded by quotation marks and separated by commas e.g. `first@email.com, second@email.com, ...`. If you are sending to a single recipient, you can just input the email with no quotation marks, like `mailer send someBucket some@email.com`

`-m or --marketo` will send the Marketo HTML. **WARNING**: if there are any variables in the MJML, Mailer will send it as is. A future implementation should replace all variables with their respective defaults when sending a Marketo HTML.

### import \<name\> **WARNING**: this functionality is currently broken

Downloads the template's files from the supabase bucket. Files are saved at `root/downloads`.

### spam \[-b, -t, -l]

This command runs the functions required to set up and run SpamAssassin.

`-b or --build` will build SpamAssassin's Docker image.

`-t or --test` will fetch the last email compiled with `mailer prepare`, convert it to RFC822 and run it through SpamAssassin's tests. Will print a score to the terminal and save a log file containing more detailed information about the test. You can point Mailer to a specific HTML file by appending a path after -t

`-l or --learn` will run SpamAssassin through a dataset of over 10,000 emails, some spam, others ham, to train its bayes filter

## Usage

First, run `mailer`. You will be prompted for the supabase key and URL. Then run `mailer save-credentials <email@gmail.com> <yourpassword>` to connect to the email from which samples will be sent. MailGuardian is currently only compatible with Gmail. Use an app password that you can generate at account settings over at (gmail.com)[https://www.gmail.com].

Each template should have its own folder, implemented on supabase as buckets. Create a bucket with `mailer template <name> -c`. Use a name that makes sense and that you will remember.

**TIP**: if you ever forget a bucket name or if it even exists and you don't want to check supabase manually, just run `mailer template -l` and MailGuardian will list all buckets.

Export the .mjml and .png files to the remote bucket with `mailer export <name> [-n] [localpath]`. The `-n` flag is needed when exporting a template for the first time. After that, MailGuardian will save the path and the next time you run `mailer export` you won't need to specify the path anymore. The template folder MUST follow this guideline [here](#about) for the export to work succesfully.

Use `mailer prepare [-m] <name>` to parse the .MJML file into an HTML file that can then be sent over email.

To send a test email, use `mailer send <name> <"first@recipient.com, second@recipient.com, ...">`.

If you'd like to gauge the spam score of the email you've build, then first you need to build a Docker image of SpamAssassin. After installing Docker, run `mailer spam --build` to build the image. Then run `mailer spam --test` to run the test. Keep in mind that Mailer will run the last email you've ran `mailer prepare` on before, so make sure to have the email you want to test compiled. The `-t` accepts an optional path, but this **CURRENTLY BROKEN**.

SpamAssassin results can be improved if you train it with real examples of spam and ham. The SpamAssassin Public Corpus has been added as a dependency, and will be used to train SpamAssassin if you run the `mailer spam --learn` command. It takes a few minutes, but results can be dramatically improved.

To download the a template's files, including images, the MJML file and either regular or Marketo HTML, use `mailer import <bucketname>`. If you don't use any flag, the regular HTML will be downloaded.

## Known bugs

### After selecting a folder, Mailer says the path is invalid

Sometimes, when selecting a folder from the dialog, Mailer will accuse the path of being broken. That is because win-select-folder is not working properly. If you encounter this bug, just select the folder again and it should work.

### After running `mailer export` and trying to run `mailer prepare`, Mailer says it can't find the template

Sometimes, after running `mailer export`, the template will not be found when running `mailer prepare`. This is because something went wrong with the upload. There could be many reasons for that, out of our control. If you encounter this bug, just run `mailer export` again and it should work.