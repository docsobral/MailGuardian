import ora from 'ora';
import chalk from 'chalk';
import PDFDocument from 'pdfkit';
import { resolve } from 'node:path';
import { spawn } from 'child_process';
// @ts-ignore
import mailcomposer from 'mailcomposer';
import { createWriteStream } from 'node:fs';
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
    process.stdout.write('\n');
    const spinner = ora(`${chalk.yellow('Starting container...')}`).start();
    const child = spawn('sh', ['start.sh']);

    child.on('error', (error) => {
      spinner.fail(error.message);
      throw new Error(error.message);
    });

    child.on('close', (code) => {
      if (code === 0) {
        spinner.succeed(`${chalk.yellow('Started container...')}`);
        resolve();
      } else {
        spinner.fail(`${chalk.red(`Script exited with code ${code}`)}`);
        reject(`Script exited with code ${code}`);
      }
    });
  });
}

async function stopContainer() {
  // Make the shell script executable
  return new Promise<void>((resolve, reject) => {
    process.stdout.write('\n');
    const spinner = ora(`${chalk.yellow('Stopping container...')}`).start();
    const child = spawn('sh', ['stop.sh']);

    child.on('error', (error) => {
      spinner.fail(error.message);
      reject(error.message);
    });

    child.on('close', (code) => {
      if (code === 0) {
        spinner.succeed(`${chalk.yellow('Stopped container...')}`);
        resolve();
      } else {
        spinner.fail(`${chalk.red(`Script exited with code ${code}`)}`);
        reject(`Script exited with code ${code}`);
      }
    });
  });
}

async function trainSpamAssassin() {
  // Make the shell script executable
  return new Promise<void>((resolve, reject) => {
    process.stdout.write('\n');
    const spinner = ora(`${chalk.yellow('Training...\n')}`).start();
    const child = spawn('sh', ['train.sh']);

    child.on('error', (error) => {
      spinner.fail(error.message);
      reject(error.message);
    });

    child.stderr.on('data', (data) => {
      spinner.text = `${spinner.text}${data.toString()}`;
    });

    child.stdout.on('data', data => {
      spinner.text = `${spinner.text}${data}`;
    })

    child.on('close', (code) => {
      if (code === 0) {
        spinner.succeed();
        resolve();
      } else {
        spinner.fail(`Script exited with code ${code}`);
        reject(`Script exited with code ${code}`);
      }
    });
  });
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
  await trainSpamAssassin().then(async () => await stopContainer());
}

export async function buildImage(): Promise<void> {
  const dockerBuild = spawn('docker', ['build', '-t', 'spamassassin:latest', 'sa']);
  dockerBuild.stdout.on('data', (data) => {
    console.log(data.toString());
  });

  dockerBuild.stderr.on('data', (data) => {
    console.error(data.toString());
  });

  dockerBuild.on('exit', (code) => {
    if (code !== 0) {
      console.error(`${chalk.red(`Docker build process exited with code ${code}`)}`);
    } else {
      console.log(`${chalk.green('Docker build process completed successfully!')}`);
    }
  });
}

interface SpamAnalysis {
  [rule: string]: string;
}

interface SpamResult {
  totalPoints: number;
  analysis: SpamAnalysis;
}

/**
 * @description Parses the spam analysis from the log.txt file that SpamAssassin generates
 *
 * @remarks
 * This function takes the output that SpamAssassin generates and parses it into a
 * SpamResult object. The SpamResult object contains the total points and a
 * SpamAnalysis object that contains the rule and description for each rule.
 * The SpamAnalysis object is a dictionary where the key is the rule and the
 * value is the description.
 *
 * @example
 *
 * // Returns { totalPoints: 5.1, analysis: { 'BAYES_50': 'BODY: Bayes spam probability is 50 to 60%'... } }
 * const spamResult = parseSpamAnalysis(emailText);
 *
 * @param {string} emailText The log.txt file that SpamAssassin generates
 *
 * @returns {SpamResult | null} The result of the spam analysis
 */
export function parseSpamAnalysis(emailText: string): SpamResult {
  const startIndex: number = emailText.indexOf('Content analysis details:');

  const analysisText: string = emailText.substring(startIndex);
  const analysisLines: string[] = analysisText.split('\n').map(line => line.trim());

  const analysis: SpamAnalysis = {};
  let totalPoints: number = 0;

  for (const line of analysisLines) {
    const match: RegExpMatchArray | null = line.match(/^([\d.-]+)\s+(\w+)\s+(.*)/);
    if (match) {
      const [, pointsString, rule, description] = match;
      const points = parseFloat(pointsString);
      analysis[rule] = description;
      totalPoints += points;
    }
  }

  totalPoints = Number(totalPoints.toFixed(1));

  return {
    totalPoints,
    analysis,
  };
}

/**
 * @description Generates a PDF file from a SpamResult object
 *
 * @remarks
 * This function takes a SpamResult object and generates a PDF file using PDFKit.
 * It then saves the PDF file to the user's desktop.
 *
 * @example
 *
 * // Generates and saves a PDF file
 * generatePDF(spamResult);
 *
 * @param {SpamResult} spamResult The result of the spam analysis
 */
export function generatePDF(spamResult: SpamResult): void {
  const path: string = resolve(__dirname, 'temp\\spam-analysis.pdf')

  const doc = new PDFDocument({
    margins: {
      top: 50,
      bottom: 50,
      left: 50,
      right: 50,
    },
  });

  doc.pipe(createWriteStream(path));

  // Add title page
  doc.fontSize(25).text('Spam Analysis', {
    align: 'center',
    underline: true,
  });
  doc.moveDown();
  doc.fontSize(15).text(`Author: Mailer`);
  doc.moveDown();
  doc.fontSize(15).text(`Date: ${new Date().toLocaleDateString()}`);
  doc.moveDown();
  doc.fontSize(15).text(scoreString(spamResult.totalPoints));

  // Add analysis section
  doc.addPage();
  doc.fontSize(20).text('Analysis', {
    align: 'center',
    underline: true,
  });
  doc.moveDown();
  Object.keys(spamResult.analysis).forEach((key) => {
    doc.fontSize(15).text(`${key}: ${spamResult.analysis[key]}`);
    doc.moveDown();
  });

  doc.end();
}

/**
 * @description Generates a string based on the score
 *
 * @remarks
 * This function takes the score and generates a string based on the score.
 * The string is used to display the score to the user.
 *
 * @example
 *
 * // Returns 'Score: 5.1\n\nThis email will most likely be marked as spam.'
 * const scoreString = scoreString(5.1);
 *
 * @param {number} score - The score of the email
 *
 * @returns {string} The string based on the score
 */
function scoreString(score: number): string {
  if (score < 5) {
    if (score > 3.5) {
      return `Score: ${score}\n\nThis email might be marked as spam.`;
    }

    return `Score: ${score}\n\nThis email will most likely NOT be marked as spam.`;
  }

  else if (score < 6.5) {
    return `Score: ${score}\n\nThis email will most likely be marked as spam.`;
  }

  return `Score: ${score}\n\nThis email will DEFINITELY be marked as spam.`;
}