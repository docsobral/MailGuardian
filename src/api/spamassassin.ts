import ora from 'ora';
import chalk from 'chalk';
// @ts-ignore
import mailcomposer from 'mailcomposer';
import { spawn, exec } from 'child_process';
import { __dirname, saveFile } from './filesystem.js';

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
    const sa = spawn('docker', ['exec', 'spamassassin-app', 'spamassassin', '-x', '-t', 'email.txt']);
    let score: number;
    let spam: string;
    let logBuffer: Buffer = Buffer.from('');

    process.stdout.write('\n');
    const spinner = ora(`${chalk.yellow(`Testing email...`)}`).start();

    sa.stdout.on('data', data => {
      const match = /X-Spam-Status: (.*), score=([-0-9.]+)\s/.exec(data.toString());
      if (match !== null) {
        spam = match[1];
        score = parseFloat(match[2]);
      }

      logBuffer = Buffer.concat([logBuffer, data]);
    });

    sa.stderr.on('data', data => {
      console.error(`${data}`);
    });

    sa.on('close', code => {
      if (code !== 0) {
        reject(spinner.fail(`SpamAssassin exited with code ${code}`));
      } else if (score === null) {
        reject(spinner.fail('Could not determine spam score'));
      } else {
        spinner.succeed(`${chalk.yellow('Results:')}\n${chalk.green(`Spam: ${spam}`)}\n${chalk.green(`Score: ${score}`)}`);
      }

      saveFile(__dirname + 'temp', 'log.txt', logBuffer)
        .then(() => resolve())
        .catch(err => reject(err));
    });
  });
}

async function startContainer() {
  // Make the shell script executable
  return new Promise<void>((resolve, reject) => {
    exec('chmod +x start.sh', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error making script executable: ${error.message}`);
        reject();
      }
      if (stderr) {
        console.error(`Error making script executable: ${stderr}`);
        reject();
      }

      // Run the shell script
      exec('start.sh', (error, stdout, stderr) => {
        if (error) {
          console.error(`Error running script: ${error.message}`);
          reject();
        }
        if (stderr) {
          console.error(`Error running script: ${stderr}`);
          reject();
        }

        resolve();
      });
    });
  })
}

async function stopContainer() {
  // Make the shell script executable
  return new Promise<void>((resolve, reject) => {
    exec('chmod +x stop.sh', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error making script executable: ${error.message}`);
        reject();
      }
      if (stderr) {
        console.error(`Error making script executable: ${stderr}`);
        reject();
      }

      // Run the shell script
      exec('stop.sh', (error, stdout, stderr) => {
        if (error) {
          console.error(`Error running script: ${error.message}`);
          reject();
        }
        if (stderr) {
          console.error(`Error running script: ${stderr}`);
          reject();
        }

        resolve();
      });
    });
  })
}

async function trainSpamAssassin() {
  // Make the shell script executable
  return new Promise<void>((resolve, reject) => {
    exec('chmod +x train.sh', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error making script executable: ${error.message}`);
        reject();
      }
      if (stderr) {
        console.error(`Error making script executable: ${stderr}`);
        reject();
      }

      // Run the shell script
      exec('train.sh', (error, stdout, stderr) => {
        if (error) {
          console.error(`Error running script: ${error.message}`);
          reject();
        }
        if (stderr) {
          console.error(`Error running script: ${stderr}`);
          reject();
        }

        resolve();
      });
    });
  })
}

export async function isSpam(path: string): Promise<void> {
  await startContainer();
  copyEmail(path).then(async () => await testEmail()).then(async () => await stopContainer());
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

export async function train(): Promise<void> {
  await startContainer();
  // await trainSpamAssassin().then(async () => await stopContainer());
  await trainSpamAssassin();
}