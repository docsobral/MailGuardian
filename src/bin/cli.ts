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


import { __dirname, cleanTemp, getChildDirectories, manageTemplate, openVS, saveFile, getFile, save, createFolder, createFolders, deleteFolder, getFolders, getImage } from '../api/filesystem.js';
import { imagesUrls, listBuckets, listImages, listFiles, fileExists, deleteFile, uploadFile, deleteBucket, manageBucket } from '../api/supabase.js';
import { buildImage, convertHTML, isSpam, train, parseSpamAnalysis } from '../api/spamassassin.js';
import { EnquireTypes, EnquireNames, EnquireMessages, enquire } from '../api/enquire.js';
import { importComponents, listComponents } from '../lib/components.js';
import { downloadMJML, parseMJML } from '../lib/prepare.js';
import { uploadImages, uploadMJML } from '../lib/export.js';
import { listComponents as list } from '../lib/append.js';
import { downloadHTML, mailHTML } from '../lib/mail.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { isLoggedIn, login } from '../lib/login.js';
import { Broadcaster } from '../api/broadcaster.js';
import { getPath } from '../lib/filestats.js';
import { minifyHTML } from '../lib/minify.js';
import { generatePDF } from '../api/pdf.js';
import { program } from 'commander';
import { resolve } from 'path';
import open from 'open';
import { readdir } from 'node:fs/promises';

type Config = {
  [config: string]: string;
}

type Paths = {
  [name: string]: string
}

const config: Config = JSON.parse(readFileSync(resolve(__dirname, 'config/config.json'), { encoding: 'utf8' }));

if (typeof config['SUPA_URL'] === 'undefined' || typeof config['SUPA_SECRET'] === 'undefined') {
  throw new Error('Missing API url, key or secret key! Please run \'mailer config\' to set them.');
}

export const supabase = createClient(config['SUPA_URL'], config['SUPA_SECRET']);

program
.command('login')
.description('Valitades and stores sender email address credentials')
.argument('<id>', 'User ID e.g. email@address.com')
.argument('<password>', 'If you use 2FA, your regular password will not work')
.action(async (id: string, password: string) => {
  password = password.replace(/\\/g, '');
  const broadcaster = new Broadcaster();

  try {
    const check = await isLoggedIn();

    if (check) {
      broadcaster.inform('\nYou already have saved credentials... do you want to switch accounts?');

      const { confirm } = await enquire([
        {
          type: EnquireTypes.confirm,
          name: EnquireNames.confirm,
          message: EnquireMessages.confirm
        }
      ]);

      if (confirm) {
        broadcaster.start('Validating credentials...');

        if (!(await login(id, password))) {
          broadcaster.fail('Failed to login!');
          return;
        }

        broadcaster.succeed('Success! Your credentials were saved.');
      }

      else {
        broadcaster.calm('Ok, exiting...');
        process.exit();
      }
    }

    else {
      broadcaster.start('Validating credentials...');

      if (await login(id, password)) {
        broadcaster.fail('Something went wrong... try again!');
      }

      broadcaster.succeed('Success! Your credentials were saved.');
    }
  }

  catch (error) {
    broadcaster.error(error as string);
  }
});

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
    this.switchScreen('  Welcome to MailGuardian!');

    const { answer } = await this.caster.ask([
      {
        type: 'select',
        name: 'answer',
        message: 'Choose:',
        choices: ['Components', 'Templates', 'Tasks', 'Bucket', 'Export', 'Prepare', 'Send', 'SpamAssassin', 'PDF report', 'Exit'],
      }
    ]);

    switch (answer) {
      case 'Components':
        this.components();
        break;
      case 'Templates':
        this.templates();
        break;
      case 'Tasks':
        this.tasks();
        break;
      case 'Bucket':
        this.bucket();
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
        this.caster.inform('\n  Ok, terminating process...');
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
      this.caster.inform('\n  Ok. Terminating process...');
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

        await manageTemplate(newName, false, 'component', this.caster);
        await delay(1000);
        openVS(newName, 'component', this.caster);

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

        await manageTemplate(name, true, 'component', this.caster);

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
            message: 'Enter the template\'s name: (\'Back\' to return)',
          }
        ]);

        if ((name as string).toLowerCase() === 'back') {
          this.start();
          return;
        }

        templateName = name;

        const components = getChildDirectories(resolve(__dirname, 'components'));
        const componentsList = components.map((name, index) => {
          return `${index + 1}. ${name}`;
        });

        let componentListString: string = '';

        componentsList.forEach(name => componentListString += name + '\n');

        const message = 'Which components do you want to import? (spacebar to select and return/enter to submit)';

        const { picks } = await this.caster.ask([
          {
            type: 'multiselect',
            name: 'picks',
            message,
            choices: ['Back', 'None', ...components],
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

        const result = await supabase.storage.createBucket(templateName, { public: false });
        if (result.error) {
          throw result.error;
        }
        await manageTemplate(templateName, false, 'template', this.caster);

        if (!(picks as string[]).includes('None')) {
          await importComponents(sorted, templateName, this.caster, 'template');
        }

        openVS(name, 'template', this.caster);

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
            choices: [...buckets, 'None'],
          }
        ]);

        if (toBeDeleted === 'None') {
          this.start();
          return;
        }

        try {
          await manageTemplate(toBeDeleted, true, 'template', this.caster);
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
        await listComponents(this.caster);

        this.caster.log();
        await this.caster.ask([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Press "y" when you are done viewing the list.'
          }
        ]);

        this.start();
    }
  }

  async tasks() {
    const tasksFolderPath = resolve(__dirname, 'tasks');
    await createFolders();

    this.switchScreen('Choose your option:');

    const { choice } = await this.caster.ask([
      {
        type: 'select',
        name: 'choice',
        message: 'Choose:',
        choices: ['Create', 'Delete', 'Manage', 'List', 'Back'],
      }
    ]);

    if (choice === 'Back') {
      this.start();
    }

    let taskName: string;

    const folders = await getFolders(tasksFolderPath, this.caster);

    switch (choice) {
      case 'Create':
        const { name } = await this.caster.ask([
          {
            type: 'input',
            name: 'name',
            message: 'Enter the task\'s name: (\'Back\' to return)',
          }
        ]);

        if ((name as string).toLowerCase() === 'back') {
          this.tasks();
          return;
        }

        taskName = name;
        await createFolder(resolve(tasksFolderPath, taskName), this.caster, 'task');

        const result = await supabase.storage.createBucket(taskName, { public: false });
        if (result.error) {
          throw result.error;
        }

        await delay(1000);

        this.tasks();
        break;

      case 'Delete':
        const { taskToDelete } = await this.caster.ask([
          {
            type: 'autocomplete',
            name: 'taskToDelete',
            message: 'Enter the task\'s name: (\'Back\' to return)',
            choices: [...folders, 'Back'],
          }
        ]);

        if ((taskToDelete as string).toLowerCase() === 'back') {
          this.tasks();
          return;
        }

        await deleteFolder(resolve(tasksFolderPath, taskToDelete), this.caster, 'task');

        const deletionResult = await deleteBucket(taskToDelete);
        if (deletionResult.error) {
          throw deletionResult.error;
        }

        await delay(2000);

        this.tasks();
        break;

      case 'Manage':
        let pickedTask: string;

        const { taskToManage } = await this.caster.ask([
          {
            type: 'autocomplete',
            name: 'taskToManage',
            message: 'Choose the task you want to manage: (\'Back\' to return)',
            choices: [...folders, 'Back'],
          }
        ]);

        pickedTask = taskToManage;

        if ((taskToManage as string).toLowerCase() === 'back') {
          this.tasks();
          break;
        }

        const { choice } = await this.caster.ask([
          {
            type: 'select',
            name: 'choice',
            message: `What would like to do at ${pickedTask}? (\'Back\' to return)`,
            choices: ['Create email', 'Delete email', 'List emails', 'Back'],
          }
        ]);

        const taskFolderPath = resolve(tasksFolderPath, pickedTask);
        const emails = await getFolders(taskFolderPath, this.caster);

        if (choice === 'Create email') {
          const { emailName } = await this.caster.ask([
            {
              type: 'input',
              name: 'emailName',
              message: 'Name this email: (\'Back\' to return)',
            }
          ]);

          if ((emailName as string).toLowerCase() === 'back') {
            this.start();
            break;
          }

          const { pick } = await this.caster.ask([
            {
              type: 'select',
              name: 'pick',
              message: 'Would how you would like to create this email: (\'Back\' to return)',
              choices: ['From components', 'From templates', 'Blank', 'Back'],
            }
          ]);

          if (pick === 'From components') {
            const components = getChildDirectories(resolve(__dirname, 'components'));

            const { picks } = await this.caster.ask([
              {
                type: 'multiselect',
                name: 'picks',
                message: 'Which components do you want to import? (spacebar to select and return/enter to submit)',
                choices: ['Back', ...components],
              }
            ]);

            if ((picks as string[]).includes('Back')) {
              this.tasks();
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

            await manageTemplate(emailName, false, 'email', this.caster, pickedTask, emailName);

            if (!(picks as string[]).includes('None')) {
              await importComponents(sorted, emailName, this.caster, 'email', pickedTask, emailName);
            }

            openVS(emailName, 'email', this.caster, pickedTask, emailName);

            await delay(3000);
            this.tasks();
          }

          else if (pick === 'From templates') {
            const templates = getChildDirectories(resolve(__dirname, 'templates'));

            const { pick } = await this.caster.ask([
              {
                type: 'select',
                name: 'pick',
                message: 'Which components do you want to import? (spacebar to select and return/enter to submit)',
                choices: ['Back', ...templates],
              }
            ]);

            if ((pick as string[]).includes('Back')) {
              this.tasks();
              break;
            }

            await manageTemplate(emailName, false, 'email', this.caster, pickedTask, emailName);

            await delay(1000);

            const templatePath = resolve(__dirname, 'templates', pick)
            const mjml = readFileSync(resolve(templatePath, 'index.mjml'), { encoding: 'utf8' });
            writeFileSync(resolve(taskFolderPath, emailName, 'index.mjml'), mjml, { encoding: 'utf8' });

            const imageNames: string[] = await readdir(resolve(templatePath, 'img'));
            const images = imageNames.map(imageName => getImage(templatePath, imageName));
            images.forEach((image, index) => {
              writeFileSync(resolve(taskFolderPath, emailName, 'img', imageNames[index]), image);
            });

            openVS(emailName, 'email', this.caster, pickedTask, emailName);
            await delay(3000);

            this.start();
          }

          else if (pick === 'Blank') {
            await manageTemplate(emailName, false, 'email', this.caster, pickedTask, emailName);
            openVS(emailName, 'email', this.caster, pickedTask, emailName);
            await delay(3000);

            this.start();
          }
        }

        else if (choice === 'Delete email') {
          const { emailToDelete } = await this.caster.ask([
            {
              type: 'autocomplete',
              name: 'emailToDelete',
              message: 'Enter the email\'s name: (\'Back\' to return)',
              choices: ['Back', ...emails],
            }
          ]);

          if ((emailToDelete as string).toLowerCase() === 'back') {
            this.tasks();
            return;
          }

          deleteFolder(resolve(taskFolderPath, emailToDelete), this.caster, 'email');
          await delay(2000);

          this.tasks();
        }

        else if (choice === 'List emails') {
          this.caster.inform('\nTasks:');
          let count = 1;
          for (let index in emails) {
            this.caster.logSeries([[`  ${count}.`, 'yellow'], [` ${emails[index]}`, 'blue']]);
            count++
          }

          this.caster.log();

          await this.caster.ask([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Press "y" when you are done viewing the list.'
            }
          ]);

          this.tasks();
        }

        else if (choice === 'Back') {
          this.tasks();
        }

        break;

      case 'List':
        this.caster.inform('Tasks:');
        let count = 1;
        for (let index in folders) {
          this.caster.logSeries([[`  ${count}.`, 'yellow'], [` ${folders[index]}`, 'blue']]);
          count++
        }

        this.caster.log();
        await this.caster.ask([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Press "y" when you are done viewing the list.'
          }
        ]);

        this.tasks();
    }
  }

  async bucket() {
    this.switchScreen('Choose your option:');

    const { choice } = await this.caster.ask([
      {
        type: 'select',
        name: 'choice',
        message: 'Choose:',
        choices: ['Create', 'Delete', 'List', 'Back'],
      }
    ]);

    if (choice === 'Back') {
      this.start();
    }

    else if (choice === 'List') {
      await list(this.caster, true);

      this.caster.log();
      await this.caster.ask([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Press "y" when you are done viewing the list.'
        }
      ]);

      this.start();
    }

    else if (choice === 'Create') {
      const { name } = await this.caster.ask([
        {
          type: 'input',
          name: 'name',
          message: 'Enter the bucket\'s name: (\'Back\' to return)'
        }
      ]);

      if ((name as string).toLowerCase() === 'back') {
        this.start();
        return;
      }

      await manageBucket(name, 'create', this.caster);

      await delay(2000);

      this.start();
      return;
    }

    else {
      const { data: availableTemplates } = await listBuckets();

      if (!availableTemplates) {
        throw new Error('Something happened while trying to fetch the buckets list...');
      }

      const buckets = availableTemplates.map(bucket => bucket.name);

      const { name: toBeDeleted } = await this.caster.ask([
        {
          type: 'autocomplete',
          name: 'name',
          message: 'Enter the bucket\'s name:',
          choices: [...buckets, 'None'],
        }
      ]);

      if (toBeDeleted === 'None') {
        this.start();
        return;
      }

      try {
        await manageTemplate(toBeDeleted, true, 'template', this.caster);
      } catch (error) {
        throw error;
      }

      const deletionResult = await deleteBucket(toBeDeleted);
      if (deletionResult.error) {
        throw deletionResult.error;
      }

      await delay(2000);

      this.start();
      return;
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
    const choices: string[] = getChildDirectories(resolve(__dirname, 'templates'));

    switch (choice) {
      case 'Template':
          const { name } = await this.caster.ask([
            {
              type: 'autocomplete',
              name: 'name',
              message: 'Enter the template\'s name:',
              choices: [...choices, 'Back']
            }
          ]);

          if ((name as string).toLowerCase() === 'back') {
            this.export();
            break;
          }

          if (!paths[name]) paths[name] = resolve(__dirname, 'templates', name);

          save('paths', name, paths[name]);
          await uploadMJML(name, paths[name], false, this.caster);
          await uploadImages(name, paths[name], this.caster);

          await delay(2000);
          this.start();
          break;

      case 'Component (not implemented)':
        this.start();
        break;
    }
  }

  async prepare() {
    let { data } = await listBuckets();

    if (!data) {
      throw new Error('Something wrong happened while fetchin buckets from the server!');
    }

    if (data && data?.length === 0) {
      this.caster.inform('\n  There are no templates to fetch in the server...');
      await delay(2000);
      this.start()
      return;
    }

    const buckets = data.map(bucket => bucket.name);

    const { name, marketo, minify } = await this.caster.ask([
      {
        type: 'autocomplete',
        name: 'name',
        message: 'What is the template\'s name?',
        choices: buckets,
      },
      {
        type: 'confirm',
        name: 'marketo',
        message: 'Marketo?',
      },
      {
        type: 'confirm',
        name: 'minify',
        message: 'Minify?',
      },
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

      let parsedHTML = parseMJML(readFileSync(resolve(__tempdirname, 'source.mjml'), { encoding: 'utf8' }), marketo);
      if (minify) {
        parsedHTML = minifyHTML(parsedHTML);
      }
      await saveFile(__tempdirname, 'parsed.html', parsedHTML);

      const list = await listFiles(name);
      const exists = await fileExists(`${marketo? 'marketo.html' : 'index.html'}`, list.data);

      if (exists) {
        const result = await deleteFile(`${marketo? 'marketo.html' : 'index.html'}`, name);

        if (result.error) {
          this.caster.fail();
          this.caster.error(`Failed to delete ${marketo? 'marketo.html' : 'index.html'} file! ${result.error.stack?.slice(17)}`);
        }
      }

      const results = await uploadFile(readFileSync(resolve(__tempdirname, 'parsed.html'), { encoding: 'utf8' }), `${marketo? 'marketo.html' : 'index.html'}`, name);

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

    if (availableTemplates && availableTemplates?.length === 0) {
      this.caster.inform('\n  There are no templates to fetch in the server...');
      await delay(2000);
      this.start()
      return;
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

    let log: string = '';

    try {
      log = readFileSync(resolve(__dirname, 'temp/log.txt'), 'utf-8');
      const analysis = parseSpamAnalysis(log);
      await generatePDF(analysis, paths[last]);
      this.caster.succeed(`Generated PDF file at ${this.caster.color(resolve(__dirname, 'temp/spam-analysis.pdf'), 'green')}`);
    }

    catch (error) {
      console.log(error)
      this.caster.fail('Couldn\'t find the log file. Run a SpamAssassin test before trying to generate a PDF report!');

      await delay(3500);
      this.start();
      return;
    }

    await delay(2000);
    this.start();

    open(resolve(__dirname, 'temp/spam-analysis.pdf'), { app: { name: 'browser' } });
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

if (process.argv[2]) {
  program.parse(process.argv);
} else {
  new MailGuardian().initialize();
}