import { spawn } from 'child_process';
// @ts-ignore
import mailcomposer from 'mailcomposer';
import { __dirname, saveFile } from './filesystem.js';
import { Broadcaster } from './broadcaster.js';

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

async function testEmail(broadcaster: Broadcaster): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const sa = spawn('docker', ['exec', 'spamassassin-app', 'spamassassin', '-x', '-t', 'email.txt']);
    let score: number;
    let logBuffer: Buffer = Buffer.from('');

    broadcaster.start(`Testing email...`);

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
        reject(broadcaster.fail(`SpamAssassin exited with code ${code}`));
      } else if (score === null) {
        reject(broadcaster.fail('Could not determine spam score'));
      } else {
        broadcaster.succeed(`${broadcaster.color('Score:', 'yellow')}${broadcaster.color(` ${score}`, 'green')}`);
      }

      saveFile(__dirname + 'temp', 'log.txt', logBuffer)
        .then(() => resolve())
        .catch(err => reject(err));
    });
  });
}

async function startContainer(broadcaster: Broadcaster): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    broadcaster.start('Starting container...');
    const child = spawn('sh', ['./sa/start.sh']);

    child.on('error', (error) => {
      broadcaster.fail(error.message);
      throw new Error(error.message);
    });

    child.on('close', (code) => {
      if (code === 0) {
        broadcaster.succeed('Started container');
        resolve();
      } else {
        broadcaster.fail(`Script exited with code ${code}`);
        reject(`Script exited with code ${code}`);
      }
    });
  });
}

async function stopContainer(broadcaster: Broadcaster): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    broadcaster.start('Stopping container...');
    const child = spawn('sh', ['./sa/stop.sh']);

    child.on('error', (error) => {
      broadcaster.fail(error.message);
      reject(error.message);
    });

    child.on('close', (code) => {
      if (code === 0) {
        broadcaster.succeed('Stopped container');
        resolve();
      } else {
        broadcaster.fail(`Script exited with code ${code}`);
        reject(`Script exited with code ${code}`);
      }
    });
  });
}

async function trainSpamAssassin(broadcaster: Broadcaster): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    broadcaster.start('Training...\n');
    const child = spawn('sh', ['./sa/train.sh']);

    child.on('error', (error: Error) => {
      broadcaster.fail(error.message);
      reject(error.message);
    });

    child.stderr.on('data', (data: string) => {
      broadcaster.text = `${broadcaster.text}${data}`;
    });

    child.stdout.on('data', (data: string) => {
      broadcaster.text = `${broadcaster.text}${data}`;
    })

    child.on('close', (code) => {
      if (code === 0) {
        broadcaster.succeed(`'Done training'\n${broadcaster.text.slice(32)}`);
        resolve();
      } else {
        broadcaster.fail(`Script exited with code ${code}`);
        reject(`Script exited with code ${code}`);
      }
    });
  });
}

export async function isSpam(path: string, broadcaster: Broadcaster): Promise<void> {
  await startContainer(broadcaster);
  await copyEmail(path)
  await testEmail(broadcaster)
  await stopContainer(broadcaster);
}

export async function convertHTML(html: string): Promise<string> {
  const message = await mailcomposer({
    from: 'sender@email.com',
    to: 'receiver@email.com',
    subject: 'SA Analysis',
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

export async function train(broadcaster: Broadcaster): Promise<void> {
  await startContainer(broadcaster);
  await trainSpamAssassin(broadcaster).then(async () => await stopContainer(broadcaster));
}

export async function buildImage(broadcaster: Broadcaster): Promise<void> {
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
        broadcaster.error(`Docker build process exited with code ${code}`);
        reject();
      } else {
        broadcaster.log(broadcaster.color('Docker build process completed successfully!', 'green'));
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