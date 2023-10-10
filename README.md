# MailGuardian

## About

This tool was built with the initial purpose of serving as a quick means of proof testing email templates built with the MJML framework. Eventually it grew to be more than that, and it's taking the shape of a suite for testing and compiling emails. You can send email samples, build and store templates, build components, test for spam score and compile MJML emails into regular HTML or Marketo compatible HTML.

## Instalation

MailGuardian was made and tested with TypeScript v5.0.2 and Node v18.12.0. Your mileage may vary depending on the version you have installed.

1. Install [Docker](https://www.docker.com/)
2. Create a supabase project and open the API settings page
3. Run `npm install -g mailguardian`
4. Run the `install-mailer` and provide the service_role key, project URL and provide a secret key
5. Run `mg login <email> <password>`
6. You are ready to start, just run `mg` start the CLI.

## Style requirements for importing components

For now, the only format supported by the component importer is the one below. Outer styles must come first, followed by a 480px media query and a 280px media query. A different order hasn't been tested, so keep to this one.

```
<mj-head>
  <mj-style>
    outer-style {
      styles;
    }

    @media (max-width: 480px) {
      480px-mobile-styles;
    }

    @media (max-width: 280px) {
      280px-mobile-styles
    }
  </mj-style>
</mj-head>
```

## Requirements for Marketo MJML

 ***ALL direct child elements of `<mjml>` (top elements) in the MJML file (`<mj-section>` or `<mj-wrapper>`) MUST have a `css-class` attribute. That is how the Marketo modules are going to be named (can be renamed later). Try using a name descriptive of the function of the section/wrapper.***

 ***All inline padding of top elements (`<mj-section>` or `<mj-wrapper>`), MUST be fixed. Variables are NOT allowed as values for top elements.***

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

```
<mj-column
  background-color="${color: columnBgColor; default: #F2F2F2}"
  padding="0px ${number: columnHPadding; default: 10}px">
  ***CHILDREN***
</mj-column>
```



The default field is **NOT** optional. The default field of a text variable can be filled with any kind of text, whitespace and most special characters. It can be wrapped by single quotes. Whitespace before and after the start of the text will be trimmed.

Remember to follow the template correctly.

## Usage

Create and use components to build templates. The steps should be self explanatory. You can create a new template from scratch, without importing components. When you create a template, MailGuardian also takes care of creating remote mirror bucket. This bucket is used for send e-mail proof tests. Images must be hosted for them to load when you open an email.

The steps you must follow to send a proof test are:

1. create a template
2. export the template to the server
3. prepare the template to be sent
4. send the proof test

You can also use the spam scoring function. To use it, you must have docker installed. First, build the SpamAssassin image. After building it, you can test an email straight away. To improve results, you can also train SpamAssassin. MailGuardian takes care of fetching a spam and ham database that it uses to train SpamAssassin.

Finally, you can generate a report on the email. The report compiles SpamAssassin results as well as checking if the HTML file is too large (Gmail cropping) or if the loaded email weight is too large.

## Known bugs

1. Component sorter doesn't work properly in the native Bash shell:
  - This is a problem with the Enquirer library
  - It DOES work in the Bash shell inside VSCode

2. I get a ENOENT error after selecting a folder from the folder select window:
  - This is a problem with the win-select-folder library
  - Sometimes it appends a linebreak in the middle of the path, which breaks it
  - Try again and it should work