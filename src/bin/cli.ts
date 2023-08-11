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

import { __dirname, getChildDirectories, manageTemplate, openVS } from '../api/filesystem.js';
import { importComponents, listComponents } from '../lib/components.js';
import { createClient } from '@supabase/supabase-js';
import { Broadcaster } from '../api/broadcaster.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'path';

type Config = {
  [config: string]: string;
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
        choices: ['Components', 'Templates', 'Export', 'Send', 'Exit'],
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
        break;
      case 'Send':
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

        await delay(5000);
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

        await delay(5000);
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

    // @ts-ignore
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

        let componentListString: string = '';

        componentsList.forEach(name => componentListString += name + '\n');

        const message = `Which components do you want to import? (e.g.: 1, 14, 5, 3, 4)\nBack - Exit - None\n${componentListString}`

        const { picks } = await this.caster.ask([
          {
            type: 'input',
            name: 'picks',
            message,
            result(names) {
              const indexes = names.split(',').map(index => (Number(index.trim()) - 1).toString());

              return indexes as any;
            }
          }
        ]);

        const pickedComponents = (picks as string[]).map((value) => {
          return components[Number(value)];
        }).join(', ');

        if ((picks as string[]).includes('Back')) {
          this.templates();
          break;
        }

        const result = await supabase.storage.createBucket(templateName, { public: false });
        if (result.error) {
          throw result.error;
        }
        await manageTemplate(templateName, false, 'template');

        if (!(picks as string[]).includes('None')) {
          await importComponents(pickedComponents, templateName, this.caster);
        }

        openVS(name, 'template');

        await delay(5000);
        this.start();
        break;

      case 'Delete':
        const { name: toBeDeleted } = await this.caster.ask([
          {
            type: 'input',
            name: 'name',
            message: 'Enter the template\'s name:',
          }
        ]);

        try {
          await manageTemplate(toBeDeleted, true, 'template');
        } catch (error) {
          throw error;
        }

        const deletionResult = await supabase.storage.deleteBucket(toBeDeleted);
        if (deletionResult.error) {
          throw deletionResult.error;
        }

        await delay(5000);

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

  async export () {
    this.switchScreen('Choose your option:');

    const { choice } = await this.caster.ask([
      {
        type: 'select',
        name: 'choice',
        message: 'Choose:',
        choices: ['Template', 'Component', 'Back'],
      }
    ]);

    if (choice === 'Back') {
      this.start();
    }

    switch (choice) {
      case 'Template':
        // const { form } = await this.caster.ask([
        //   {
        //     type: 'form',
        //     name: 'choice',
        //     message: 'Choose:',
        //     choices: ['Template', 'Component', 'Back'],
        //   }
        // ]);
        break;

      case 'Component':
        break;
    }
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

new MailGuardian().initialize();