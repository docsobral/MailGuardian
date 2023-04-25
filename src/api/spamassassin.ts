import ora from 'ora';
import chalk from 'chalk';
import PDFDocument from 'pdfkit';
import { resolve } from 'node:path';
import { spawn } from 'child_process';
// @ts-ignore
import mailcomposer from 'mailcomposer';
import { __dirname, saveFile } from './filesystem.js';
import { createWriteStream, readFileSync } from 'node:fs';

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

  enum ignoredRules {
    'NO_RELAYS',
    'NO_RECEIVED',
    'FREEMAIL_FROM',
  }

  for (const line of analysisLines) {
    const match: RegExpMatchArray | null = line.match(/^([\d.-]+)\s+(\w+)\s+(.*)/);
    if (match) {
      const [, pointsString, rule, description] = match;
      const points = parseFloat(pointsString);
      if (!(rule in ignoredRules) && pointsString !== '0.0') {
        analysis[`${pointsString} - ${rule}`] = description;
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

  /**
   * @description Generates a string based on the score
   *
   * @remarks
   * This function takes the score and generates a string based on the score.
   * The string is used to display the score to the user.
   *
   * @example
   *
   * // Returns 'Score: 5.1\n\nThis email will most likely be flagged as spam.'
   * const scoreString = scoreString(5.1);
   *
   * @param {number} score - The score of the email
   *
   * @returns {string} The string based on the score
   */
  function scoreString(score: number): string {
    if (score < 4.5) {
      if (score > 3.5) {
        return `This email might be flagged as spam`;
      }

      else if (score > 2.5) {
        return `Very strict spam filters may flag this email as spam`;
      }

      return `This email is unlikely to be flagged as spam`;
    }

    else if (score < 6) {
      return `This email will most likely be flagged as spam`;
    }

    return `This email will DEFINITELY be flagged as spam`;
  }

  const diagnosis: string = scoreString(spamResult.totalPoints);

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

  // Draw logo
  doc.image(resolve(__dirname, 'logo.jpg'), 150, 50, {
    width: 300,
    height: 83.67,
  });

  // Add title page
  doc.moveDown(2);
  doc.fontSize(25).text('Spam Analysis', {
    align: 'center',
  });
  doc.fontSize(10).text(`${new Date().toLocaleDateString()}`, {align: 'center'});
  doc.moveDown();
  doc.fontSize(15).text(`${diagnosis}.`, {align: 'center'});

  doc.moveDown(2);

  doc.fontSize(12).text(
    `This email was scanned by Mailer using SpamAssassin 4.0.0 to determine if it is likely to be flagged spam by email clients.\n\nVersion 4.0.0 is the most recent version of the most popular open source spam filter, which uses a very large number of different tests to determine if an email is spam. It has been around for over two decades, and has been consistently updated to stay ahead of spammers. SpamAssassin is used by many companies and organizations to filter spam.\n\nThe instance of SpamAssassin run by Mailer was trained using a large collection of spam emails (over 100 thousand samples). This allows SpamAssassin to learn what spam looks like. The training data is provided by datasets gathered over years of spam filtering, and includes very recent spam samples gathered up to March of 2023. The training data is also updated regularly to stay up to date with the latest spam trends.\n\nThis means that Mailer uses a set of fixed rules along with bayesian inference to determine if an email is spam. By scoring (0-10) emails with fixed rules and a model trained with up-to-date data, we can get a reliable diagnosis of our email's quality, allowing us to make data oriented decisions on the design of our email templates.\n\nThe score of the email is the sum of the points given by each rule, which is then compared to a threshold to determine the likelihood of the email being flagged as spam by email clients. The score of this email is ${spamResult.totalPoints}, which means that ${diagnosis.toLowerCase()}.`, {
      align: 'justify',
      columns: 2,
      columnGap: 10,
      height: 280,
    }
  );

  // Add analysis section
  // doc.addPage();
  doc.moveDown(2);
  doc.fontSize(20).text('Rules used:');
  doc.moveDown();
  Object.keys(spamResult.analysis).forEach((key) => {
    doc.fontSize(15).text(`${key}: ${spamResult.analysis[key]}`, {lineGap: 5});
  });
  doc.moveDown();
  doc.fontSize(15).text(`Total score: ${spamResult.totalPoints}`);

  doc.end();
}