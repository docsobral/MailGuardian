#! /usr/bin/env node

const { emitWarning } = process;

process.emitWarning = (warning, ...args) => {
  if (args[0] === 'ExperimentalWarning') {
    return;
  }

  if (args[0] && typeof args[0] === 'object' && args[0].type === 'ExperimentalWarning') {
    return;
  }
  // @ts-ignore
  return emitWarning(warning, ...args);
}

import { __dirname, cleanTemp, getChildDirectories, manageTemplate, openVS, saveFile, getFile, save } from '../api/filesystem.js';
import { importComponents, listComponents } from '../lib/components.js';
import { createClient } from '@supabase/supabase-js';
import { Broadcaster } from '../api/broadcaster.js';
import { uploadImages, uploadMJML } from '../lib/export.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'path';
import { imagesUrls, listBuckets, listImages, listFiles, fileExists, deleteFile, uploadFile, deleteBucket } from '../api/supabase.js';
import { downloadMJML, parseMJML } from '../lib/prepare.js';
import { downloadHTML, mailHTML } from '../lib/mail.js';
import { getPath } from '../lib/filestats.js';
import { buildImage, convertHTML, isSpam, train, parseSpamAnalysis } from '../api/spamassassin.js'
import { generatePDF } from '../api/pdf.js';
import open from 'open';

type Config = {
  [config: string]: string;
}

type Paths = {
  [name: string]: string
}

const config: Config = JSON.parse(readFileSync(__dirname + 'config\\config.json', { encoding: 'utf8' }));

if (typeof config['SUPA_URL'] === 'undefined' || typeof config['SUPA_SECRET'] === 'undefined') {
  throw new Error('Missing API url, key or secret key! Please run \'mailer config\' to set them.');
}

export const supabase = createClient(config['SUPA_URL'], config['SUPA_SECRET']);

class MailGuardian {
  _step: number;
  _path: string;
  caster: Broadcaster;

  constructor() {
    this._step = 0;
    this._path = resolve('build/bin/index.js');
    this.caster = new Broadcaster();
  }

  async initialize() {
    this.switchScreen();
    this.start();
  }

  async start() {
    this.switchScreen('Welcome to MailGuardian!');

    const { answer } = await this.caster.ask([
      {
        type: 'select',
        name: 'answer',
        message: 'Choose:',
        choices: ['Components', 'Templates', 'Export', 'Prepare', 'Send', 'SpamAssassin', 'PDF report', 'Exit'],
      }
    ]);

    switch (answer) {
      case 'Components':
        this.components();
        break;
      case 'Templates':
        this.templates();
        break;
      case 'Export':
        this.export();
        break;
      case 'Prepare':
        this.prepare();
        break;
      case 'Send':
        this.send();
        break;
      case 'SpamAssassin':
        this.spamassassin();
        break;
      case 'PDF report':
        this.pdf();
        break;
      case 'Exit':
        this.caster.inform('\nOk, terminating process...');
        await delay(1000);
        this.caster.clear();
        break;
    }
  }

  switchScreen(text?: string) {
    this.caster.clear();
    this.caster.inform(`\n${text}\n`);
  }

  async checkCommand(text: string) {
    if (text.toLowerCase() === 'quit' || text.toLowerCase() === 'exit') {
      this.caster.inform('\nOk. Terminating process...');
      await delay(1000);
      process.exit(0);
    }

    else if (text.toLowerCase() === 'back') {
      this.components();
      return 'back';
    }
  }

  async components() {
    this.switchScreen('Choose your option:');

    const { choice } = await this.caster.ask([
      {
        type: 'select',
        name: 'choice',
        message: 'Choose:',
        choices: ['Create', 'Delete', 'Back']
      }
    ]);

    if (choice === 'Back') {
      this.start();
    }

    switch (choice) {
      case 'Create':
        const { newName } = await this.caster.ask([
          {
            type: 'input',
            name: 'newName',
            message: 'Enter the component\'s name: (\'exit\' or \'back\')'
          }
        ]);

        const check = await this.checkCommand(newName);

        if (check === 'back') {
          break;
        }

        await manageTemplate(newName, false, 'component');
        await delay(1000);
        openVS(newName, 'component');

        await delay(2000);
        this.start();
        break;

      case 'Delete':
        const directories = getChildDirectories(resolve(__dirname, 'components'));

        const { name } = await this.caster.ask([
          {
            type: 'select',
            name: 'name',
            message: 'Which component do you want to delete?',
            choices: [...directories, 'Back'],
          }
        ]);

        if (name === 'Back') {
          this.components();
          break;
        }

        await manageTemplate(name, true, 'component');

        await delay(2000);
        this.start();
        break;
    }
  }

  async templates() {
    this.switchScreen('Choose your option:');

    const { choice } = await this.caster.ask([
      {
        type: 'select',
        name: 'choice',
        message: 'Choose:',
        choices: ['Create', 'Delete', 'List', 'Back'],
      }
    ]);

    let templateName: string;

    if (choice === 'Back') {
      this.start();
    }

    switch (choice) {
      case 'Create':
        const { name } = await this.caster.ask([
          {
            type: 'input',
            name: 'name',
            message: 'Enter the template\'s name:',
          }
        ]);

        templateName = name;

        const components = getChildDirectories(resolve(__dirname, 'components'))
        const componentsList = components.map((name, index) => {
          return `${index + 1}. ${name}`;
        });

        components.unshift('Back');

        let componentListString: string = '';

        componentsList.forEach(name => componentListString += name + '\n');

        const message = 'Which components do you want to import? (spacebar to select and return/enter to submit)';
        // const message = `Which components do you want to import? (e.g.: 1, 14, 5, 3, 4)\nBack - Exit - None\n${componentListString}`

        const { picks } = await this.caster.ask([
          {
            type: 'multiselect',
            name: 'picks',
            message,
            choices: components,
          }
        ]);

        if ((picks as string[]).includes('Back')) {
          this.templates();
          break;
        }

        const { sorted } = await this.caster.ask([
          {
            type: 'sort',
            name: 'sorted',
            message: 'Sort the components by the order they should appear:',
            choices: picks,
            result(names) {
              const string = (names as string[]).join(', ');
              return string;
            }
          }
        ]);

        console.log(sorted)

        await delay(5000);

        const result = await supabase.storage.createBucket(templateName, { public: false });
        if (result.error) {
          throw result.error;
        }
        await manageTemplate(templateName, false, 'template');

        if (!(picks as string[]).includes('None')) {
          await importComponents(sorted, templateName, this.caster);
        }

        openVS(name, 'template');

        await delay(2000);
        this.start();
        break;

      case 'Delete':
        const { data: availableTemplates } = await listBuckets();

        if (!availableTemplates) {
          throw new Error('Something happened while trying to fetch the buckets list...');
        }

        const buckets = availableTemplates.map(bucket => bucket.name);

        const { name: toBeDeleted } = await this.caster.ask([
          {
            type: 'autocomplete',
            name: 'name',
            message: 'Enter the template\'s name:',
            choices: buckets,
          }
        ]);

        try {
          await manageTemplate(toBeDeleted, true, 'template');
        } catch (error) {
          throw error;
        }

        const deletionResult = await deleteBucket(toBeDeleted);
        if (deletionResult.error) {
          throw deletionResult.error;
        }

        await delay(2000);

        this.start();
        break;

      case 'List':
        console.log('list');
        await listComponents(this.caster);

        // @ts-ignore
        const { confirm } = this.caster.ask([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Press "y" when you are done viewing the list.'
          }
        ]);

        this.start();
    }
  }

  async export() {
    this.switchScreen('Choose your option:');

    const { choice } = await this.caster.ask([
      {
        type: 'select',
        name: 'choice',
        message: 'Choose:',
        choices: ['Template', 'Component (not implemented)', 'Back'],
      }
    ]);

    if ((choice as string).toLowerCase() === 'back') {
      this.start();
    }

    const paths: Paths = JSON.parse(readFileSync(resolve(__dirname, 'config/paths.json'), { encoding: 'utf8'}));
    const choices: string[] = Object.keys(paths);
    choices.push('Back');

    switch (choice) {
      case 'Template':
        const { confirm } = await this.caster.ask([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Have you exported this template before?'
          }
        ]);

        let type: 'autocomplete' | 'input';

        if (confirm) {
          type = 'autocomplete';
          const { name } = await this.caster.ask([
            {
              type,
              name: 'name',
              message: 'Enter the template\'s name:',
              choices,
            }
          ]);

          if ((name as string).toLowerCase() === 'back') {
            this.export();
            break;
          }

          await uploadMJML(name, paths[name], false, this.caster);
          await uploadImages(name, paths[name], this.caster);

          await delay(2000);
          this.start();
          break;
        }

        else {
          type = 'input';
          const { name } = await this.caster.ask([
            {
              type,
              name: 'name',
              message: 'Enter the template\'s name:'
            }
          ]);

          if ((name as string).toLowerCase() === 'back') {
            this.export();
            break;
          }

          const path = await getPath();
          save('paths', name, path);

          await uploadMJML(name, path, false, this.caster);
          await uploadImages(name, path, this.caster);

          await delay(2000);
          this.start();
          break;
        }

      case 'Component (not implemented)':
        this.start();
        break;
    }
  }

  async prepare() {
    let { data } = await listBuckets();

    if (!data) {
      throw new Error('Something happened while trying to fetch the buckets list...');
    }

    const buckets = data.map(bucket => bucket.name);

    const { name } = await this.caster.ask([
      {
        type: 'autocomplete',
        name: 'name',
        message: 'What is the template\'s name?',
        choices: buckets,
      }
    ]);

    await cleanTemp();

    writeFileSync(resolve(__dirname, 'temp/last'), name, { encoding: 'utf8' });

    this.caster.start(`Fetching and parsing MJML file from the ${name} bucket...`);
    const mjmlBlob = await downloadMJML(name, false, this.caster);

    if (mjmlBlob) {
      let mjmlString = await mjmlBlob.text();
      let imgList: string[] = [];
      let signedUrlList: string[] = [];

      const imageList = await listImages(name);

      if (imageList.error) {
        this.caster.fail();
        this.caster.error(`Failed to fetch list of image names! ${imageList.error.stack?.slice(17)}`);
      }

      // @ts-ignore
      imageList.data.forEach(fileObject => imgList.push(fileObject.name));
      const signedList = await imagesUrls(name, imgList);

      if (signedList.error) {
        this.caster.fail();
        this.caster.error(`Failed to get signed URLs! ${signedList.error.stack?.slice(17)}`);
      }

      // @ts-ignore
      signedList.data.forEach(object => signedUrlList.push(object.signedUrl));

      // MOVE THIS FUNCTION TO A SEPARATE FILE
      // replace local paths for remote paths
      for (let index in imgList) {
        const localPath = `(?<=src=")(.*)(${imgList[index]})(?=")`;
        const replacer = new RegExp(localPath, 'g');
        mjmlString = mjmlString.replace(replacer, signedUrlList[index]);
      };

      const __tempdirname = resolve(__dirname, 'temp');

      // save mjml with new paths
      await saveFile(__tempdirname, 'source.mjml', mjmlString);

      const parsedHTML = parseMJML(readFileSync(resolve(__tempdirname, 'source.mjml'), { encoding: 'utf8' }), false);
      await saveFile(__tempdirname, 'parsed.html', parsedHTML);

      const list = await listFiles(name);
      const exists = await fileExists(`${false? 'marketo.html' : 'index.html'}`, list.data);

      if (exists) {
        const result = await deleteFile(`${false? 'marketo.html' : 'index.html'}`, name);

        if (result.error) {
          this.caster.fail();
          this.caster.error(`Failed to delete ${false? 'marketo.html' : 'index.html'} file! ${result.error.stack?.slice(17)}`);
        }
      }

      const results = await uploadFile(readFileSync(resolve(__tempdirname, 'parsed.html'), { encoding: 'utf8' }), `${false? 'marketo.html' : 'index.html'}`, name);

      if (results.error) {
        this.caster.fail();
        this.caster.error(`Failed to upload HTML file! ${results.error.stack?.slice(17)}`);
      }

      this.caster.succeed('Successfully parsed MJML and uploaded HTML to server');
    }

    await delay(2000);
    this.start();
  }

  async send() {
    const { data: availableTemplates } = await listBuckets();

    if (!availableTemplates) {
      throw new Error('Something happened while trying to fetch the buckets list...');
    }

    const buckets = availableTemplates.map(bucket => bucket.name);

    const { name, recipients } = await this.caster.ask([
      {
        type: 'autocomplete',
        name: 'name',
        message: 'What is the template\'s name?',
        choices: buckets,
      },
      {
        type: 'input',
        name: 'recipients',
        message: 'Enter comma-separated recipients:'
      }
    ]);

    const recipientsList = (recipients as string).split(/ *, */);

    this.caster.start('Fetching HTML file from the bucket');

    const { data, error } = await downloadHTML(name, false);

    if (error) {
      this.caster.fail();
      throw new Error('Failed to download HTML file!');
    }

    this.caster.succeed();

    if (data) {
      const htmlString = await data.text();
      try {
        this.caster.start('Sending email...');
        await mailHTML(recipientsList, htmlString);
        this.caster.succeed();
      }

      catch (error: any) {
        this.caster.fail();
        console.error(error);
      }
    }

    await delay(2000);
    this.start();
  }

  async spamassassin() {
    this.switchScreen('Choose your option:');

    const { choice } = await this.caster.ask([
      {
        type: 'select',
        name: 'choice',
        message: 'Choose:',
        choices: ['Build SpamAssassin Image', 'Test HTML', 'Train SpamAssassin', 'Back'],
      }
    ]);

    if ((choice as string).toLowerCase() === 'back') {
      this.start();
    }

    switch (choice) {
      case 'Build SpamAssassin Image':
        await buildImage(this.caster);
        await delay(2000);
        this.start();
        break;

      case 'Test HTML':
        const { confirm } = await this.caster.ask([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Do you want to test the last email you prepared?',
          }
        ]);

        let pathToFile: string = '';
        let fileName: string = 'parsed';

        if (confirm) {
          pathToFile = resolve(__dirname, 'temp');
        } else {
          pathToFile = await getPath();

          const { name } = await this.caster.ask([
            {
              type: 'input',
              name: 'name',
              message: 'What is the name of the HTML file?',
            }
          ]);

          fileName = (name as string).replace(/.html/, '');
        }

        const html = await getFile('html', pathToFile, false, fileName);
        const MIME = await convertHTML(html);
        const MIMEPath = resolve(__dirname, 'temp/MIME.txt');
        writeFileSync(MIMEPath, MIME);

        await isSpam(MIMEPath, this.caster);

        await delay(2000);
        this.start();
        break;

      case 'Train SpamAssassin':
        await train(this.caster);
        break;
    }
  }

  async pdf() {
    this.caster.start('Generating PDF...');

    const paths: Paths = JSON.parse(readFileSync(resolve(__dirname, 'config/paths.json'), { encoding: 'utf8'}));
    const last = readFileSync(resolve(__dirname, 'temp/last'), { encoding: 'utf8' });

    try {
      const log = readFileSync(__dirname + 'temp/log.txt', 'utf-8');
      const analysis = parseSpamAnalysis(log);
      await generatePDF(analysis, paths[last]);
      this.caster.succeed(`Generated PDF file at ${this.caster.color(resolve(__dirname, 'temp/spam-analysis.pdf'), 'green')}`);
    }

    catch (error) {
      this.caster.fail();
      this.caster.error(error as string);
    }

    await delay(2000);
    this.start();

    open(resolve(__dirname, 'temp/spam-analysis.pdf'), { app: { name: 'browser' } });
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

new MailGuardian().initialize();