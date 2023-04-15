import ora from 'ora';
import chalk from 'chalk';
import { spawn } from 'child_process';
// @ts-ignore
import mailcomposer from 'mailcomposer';
import { __dirname } from './filesystem.js';

async function composeUp(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const composeUp = spawn('docker-compose', ['-f', './sa/compose.yml', 'up', '--detach']);

    composeUp.stdout.on('data', data => {
      // console.log(`${data}`);
    });

    composeUp.stderr.on('data', data => {
      // console.error(`${data}`);
    });

    composeUp.on('close', code => {
      if (code !== 0) {
        console.log(`child process exited with code ${code}`);
        reject();
      }

      else {
        // console.log(`${chalk.green('Started SpamAssassin container successfully!')}`);
        resolve();
      }
    });
  });
}

async function composeDown(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const composeUp = spawn('docker-compose', ['-f', './sa/compose.yml', 'down']);

    composeUp.stdout.on('data', data => {
      // console.log(`${data}`);
    });

    composeUp.stderr.on('data', data => {
      // console.error(`${data}`);
    });

    composeUp.on('close', code => {
      if (code !== 0) {
        console.log(`child process exited with code ${code}`);
        reject();
      }

      else {
        // console.log(`${chalk.green('Closed SpamAssassin container successfully!')}`);
        resolve();
      }
    });
  })
}

async function copyEmail(path: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const copy = spawn('docker', ['cp', `${path}`, 'spamassassin-app:email.txt']);

    copy.stdout.on('data', data => {
      // console.log(`${data}`);
    });

    copy.stderr.on('data', data => {
      // console.error(`${data}`);
    });

    copy.on('close', code => {
      if (code !== 0) {
        console.log(`\nchild process exited with code ${code}`);
        reject();
      }

      else {
        // console.log(`${chalk.green('\nSucessfully copied email to be tested to the container!')}`);
        resolve();
      }
    });
  });
}

async function testEmail(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const sa = spawn('docker', ['exec', 'spamassassin-app', 'spamassassin', '-x', 'email.txt']);
    let score: number;
    let spam: string;

    process.stdout.write('\n');
    const spinner = ora(`${chalk.yellow(`Testing email...`)}`).start();

    sa.stdout.on('data', data => {
      const match = /X-Spam-Status: (.*), score=([-0-9.]+)\s/.exec(data.toString());
      if (match !== null) {
        spam = match[1];
        score = parseFloat(match[2]);
      }
      // console.log(`${data}`);
    });

    sa.stderr.on('data', data => {
      console.error(`${data}`);
    });

    sa.on('close', code => {
      if (code !== 0) {
        spinner.fail(`SpamAssassin exited with code ${code}`);
      } else if (score === null) {
        spinner.fail('Could not determine spam score');
      } else {
        spinner.succeed(`${chalk.yellow('Results:')}\n${chalk.green(`Spam: ${spam}`)}\n${chalk.green(`Score: ${score}`)}`);
      }
    });
  });
}

export async function isSpam(path: string): Promise<void> {
  await composeUp();
  copyEmail(path).then(async () => await testEmail());
  await composeDown();
}

export async function convertHTML(html: string): Promise<string> {
  const message = await mailcomposer({
    from: 'sender@email.com',
    to: 'receiver@email.com',
    subject: 'Test for SA',
    html: html,
  });

  return new Promise((resolve, reject) => {
    // @ts-ignore
    message.build((err, message) => {
      if (err) {
        reject(err);
      } else {
        resolve(message.toString());
      }
    });
  });
}