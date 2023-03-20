#! /usr/bin/env node
import { program } from 'commander';
import { isLoggedIn } from '../lib/login.js';

program.version('0.1');

program
  .command('login')
  .description('Valitades and stores sender email address credentials')
  .action(() => {
    isLoggedIn();
  });

program.parse(process.argv);