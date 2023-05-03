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

    copy.on('close', code => {
      if (code !== 0) {
        console.log(`\nChild process exited with code ${code}`);
        reject();
      }

      else {
        resolve();
      }
    });
  });
}

async function testEmail(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const sa = spawn('docker', ['exec', 'spamassassin-app', 'spamassassin', '-x', '-t', 'email.txt']);
    let score: number;
    let logBuffer: Buffer = Buffer.from('');

    process.stdout.write('\n');
    const spinner = ora(`${chalk.yellow(`Testing email...`)}`).start();

    sa.stdout.on('data', data => {
      const match = /X-Spam-Status:\s[\w]{2,3},\sscore=([-\d.]+)/.exec(data.toString());
      if (match !== null) {
        score = parseFloat(match[1]);
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
        spinner.succeed(`${chalk.yellow('Score:')}${chalk.green(` ${score}`)}`);
      }

      saveFile(__dirname + 'temp', 'log.txt', logBuffer)
        .then(() => resolve())
        .catch(err => reject(err));
    });
  });
}

async function startContainer(): Promise<void> {
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
        spinner.succeed(`${chalk.yellow('Started container')}`);
        resolve();
      } else {
        spinner.fail(`${chalk.red(`Script exited with code ${code}`)}`);
        reject(`Script exited with code ${code}`);
      }
    });
  });
}

async function stopContainer(): Promise<void> {
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
        spinner.succeed(`${chalk.yellow('Stopped container')}`);
        resolve();
      } else {
        spinner.fail(`${chalk.red(`Script exited with code ${code}`)}`);
        reject(`Script exited with code ${code}`);
      }
    });
  });
}

async function trainSpamAssassin(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    process.stdout.write('\n');
    const spinner = ora(`${chalk.yellow('Training...\n')}`).start();
    const child = spawn('sh', ['train.sh']);

    child.on('error', (error: Error) => {
      spinner.fail(error.message);
      reject(error.message);
    });

    child.stderr.on('data', (data: string) => {
      spinner.text = `${spinner.text}${data}`;
    });

    child.stdout.on('data', (data: string) => {
      spinner.text = `${spinner.text}${data}`;
    })

    child.on('close', (code) => {
      if (code === 0) {
        spinner.succeed(`${chalk.yellow('Done training')}\n${spinner.text.slice(32)}`);
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
    subject: 'SpamAssassin Test',
    html: html,
  });

  return new Promise((resolve, reject) => {
    message.build((err: string, message: string) => {
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
  return new Promise<void>((resolve, reject) => {
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
        reject();
      } else {
        console.log(`${chalk.green('Docker build process completed successfully!')}`);
        resolve();
      }
    });
  });
}

interface SpamAnalysis {
  [rule: string]: [string, string];
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

  enum IgnoredRules {
    'NO_RELAYS',
    'NO_RECEIVED',
    'FREEMAIL_FROM',
  }

  for (const line of analysisLines) {
    const match: RegExpMatchArray | null = line.match(/^([\d.-]+)\s+(\w+)\s+(.*)/);
    if (match) {
      const [, pointsString, rule, description] = match;
      const points = parseFloat(pointsString);
      if (!(rule in IgnoredRules) && pointsString !== '0.0') {
        analysis[`${rule}`] = [pointsString, description];
        totalPoints += points;
      }
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
  const path: string = resolve(__dirname, 'temp\\spam-analysis.pdf');

  function scoreString(score: number): [string, string, string] {
    switch (true) {
      case score >= 6: return ['This email will ', 'DEFINITELY', ' be flagged as spam'];
      case score >= 5: return ['This email will ', 'MOST LIKELY', ' be flagged as spam'];
      case score >= 4: return ['Very strict spam filters ', 'MAY', ' flag this email as spam'];
      default: return ['This email is ', 'UNLIKELY', ' to be flagged as spam'];
    }
  }

  function stringColor(score: number): [number, number, number] {
    switch (true) {
      case score >= 5: return [255, 27, 120];
      case score >= 4: return [255, 240, 17];
      default: return [0, 189, 250];
    }
  }

  function centerString(score: number): string {
    switch (true) {
      case score >= 6: return ' '.repeat(21);
      case score >= 5: return ' '.repeat(20);
      case score >= 4: return ' '.repeat(14);
      default: return ' '.repeat(22);
    }
  }

  const diagnosis: [string, string, string] = scoreString(spamResult.totalPoints);

  const doc = new PDFDocument({
    size: 'A4',
    info: {
      Title: 'Spam Analysis',
      Author: 'Mailer'
    },
    margins: {
      top: 50,
      bottom: 50,
      left: 50,
      right: 50,
    },
    compress: false,
    lang: 'en-US',
    displayTitle: true,
  });

  doc.pipe(createWriteStream(path));

  doc.image(resolve(__dirname, 'logo.jpg'), 152, 50, {
    align: 'right',
    width: 300,
    height: 83.67,
  });

  function daySuffix(day: number): string {
    const lastDigit = day % 10;

    switch (lastDigit) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  const currentDate = new Date();
  const day = currentDate.getDate();
  const month = currentDate.toLocaleDateString('en-uk', { month: 'long' });
  const year = currentDate.getFullYear();

  doc.fontSize(12).text('Delivery Performance', {align: 'center'});
  doc.moveDown(3);
  doc.fontSize(15).text(`Spam Analysis | ${day}${daySuffix(day)} of ${month}, ${year}`, {align: 'center'});
  doc.moveDown();
  doc.fontSize(15)
  .text(`${centerString(spamResult.totalPoints)}${diagnosis[0]}`, {continued: true})
  .fillColor(stringColor(spamResult.totalPoints))
  .text(`${diagnosis[1]}`, {continued: true})
  .fillColor('black')
  .text(`${diagnosis[2]}`, {continued: false})

  doc.moveDown(2);

  doc.fillColor('black').fontSize(12).text(
    `This email was scanned by Mailer using SpamAssassin to determine if it is likely to be flagged spam by email clients. By scoring emails with fixed rules and a trained Bayesian model, we can get a reliable qualitative diagnosis, allowing us to make data oriented decisions on the design of our email templates. The score of the email is the sum of the points given by each rule, which is then compared to a threshold to determine the likelihood of the email being flagged as spam by email clients. The total score of this email is `, {
      continued: true,
      align: 'justify',
    }
  ).text(`${spamResult.totalPoints}`, {
      continued: true,
    }
  ).text(', which means that ', {
      continued: true,
      underline: false,
  }
  ).text(`${(diagnosis[0] + diagnosis[1] + diagnosis[2]).toLowerCase()}`, {
      continued: true,
      underline: true
  }
  ).text('.', {
    continued: false,
    underline: false,
  });

  const SCORE_INDEX: number = 0;
  const DESCRIPTION_INDEX: number = 1;

  function removePrefix(text: string): string {
    return text.replace(/^(HEADER: |BODY: |URI: )+/, '');
  }

  doc.moveDown(2);
  doc.fontSize(15).text('Rules used:');
  doc.moveDown();
  Object.keys(spamResult.analysis).forEach((key) => {
    const rule: string = key.includes('BAYES') ? 'BAYES' : key;
    const description: string = key.includes('BAYES') ? 'Score given by Bayesian probabilistic model' : removePrefix(spamResult.analysis[key][DESCRIPTION_INDEX]);
    doc.fontSize(12).text(`${spamResult.analysis[key][SCORE_INDEX]} - ${rule}:`, {lineGap: 5, continued: true}).text(`${description}`, {align: 'right', continued: false});
  });
  doc.moveDown();
  doc.fontSize(12).text(`Total score: ${spamResult.totalPoints}`);

  doc.end();
}