import { readFileSync, writeFileSync, createWriteStream } from 'node:fs';
import { __dirname} from '../api/filesystem.js';
import Cryptr from 'cryptr';
import PDFDocument from 'pdfkit';
import blobStream from 'blob-stream';

export type AppState = {
  [key: string]: [(string | boolean), boolean] | string;
}

export type AppConfig = {
  [key: string]: string;
}

export type AppPaths = [string, string][];

/**
 * Takes the state of the app and returns it
 *
 * @remarks
 * This function takes the state of the app and returns it. It also decrypts any
 * encrypted values.
 *
 * @example
 * // Returns { 'logged' : [true, false], 'host': ['smtp.gmail.com', false], id: ['123456789', true], 'password': ['password', true]}
 * const state = await getState();
 *
 * @returns {Promise<AppState>} - The state of the app
 */
export async function getState(): Promise<AppState> {
  const config = JSON.parse(readFileSync(__dirname + 'config\\config.json', { encoding: 'utf8' }));
  const cryptr = new Cryptr(config['SECRET_KEY']);

  let state: AppState = JSON.parse(readFileSync(__dirname + 'config\\state.json', { encoding: 'utf8' }));

  // decrypts encrypted values (state[key][0] is encrypted if state[key][1] is true)
  Object.keys(state).forEach(key => {
    if (state[key][1]) {
      state[key] = [cryptr.decrypt(state[key][0].toString()), true];
    }
  })

  return state;
}

/**
 * Saves the state of the app
 * @remarks
 * This function takes the state of the app and saves it. It also encrypts any
 * values that need to be encrypted.
 *
 * @example
 * // Saves { 'logged' : [true, false]}
 * await saveState('logged', true);
 *
 * @example
 * // Saves { id: ['123456789', true]}
 * await saveState('id', '123456789', true);
 *
 *
 * @param {string} key - The key of the state
 * @param {string} value - The value of the state
 * @param {boolean} encrypt - Whether or not to encrypt the value
 */
export function saveState(key: string, value: string | boolean, encrypt = false): void {
  const config = JSON.parse(readFileSync(__dirname + 'config\\config.json', { encoding: 'utf8' }));
  const cryptr = new Cryptr(config['SECRET_KEY']);

  let finalValue: string;
  let state: AppState = JSON.parse(readFileSync(__dirname + 'config\\state.json', { encoding: 'utf8' }));

  if (encrypt && typeof value === 'string') {
    finalValue = cryptr.encrypt(value);
    state[key] = [finalValue, encrypt];
  } else {
    state[key] = [value, encrypt];
  }

  const stateString = JSON.stringify(state, null, 2);
  writeFileSync(__dirname + 'config\\state.json', stateString);
}

/**
 * Takes the config and paths of the app and returns them
 * @remarks
 * This function takes the config and paths of the app and returns them.
 *
 * @returns {Promise<{config: AppConfig, paths: AppPaths}>} - The config and paths of the app
 */
export function getConfigAndPath(): {config: AppConfig, paths: AppPaths} {
  const config: AppConfig = JSON.parse(readFileSync(__dirname + `config\\config.json`, { encoding: 'utf8' }));
  const paths: AppPaths = Object.entries(JSON.parse(readFileSync(__dirname + `config\\paths.json`, { encoding: 'utf8' })));

  return {config, paths}
}

/**
 * Saves the config and paths of the app
 * @remarks
 * This function takes the config and paths of the app and saves them.
 * @example
 * // Saves { 'paths': { 'inbox': 'C:\\Users\\user\\Desktop\\inbox' } }
 * save('paths', 'inbox', 'C:\\Users\\user\\Desktop\\inbox');
 *
 * @param {string} type - The type of config to save ('paths' or 'config')
 * @param {string} key - The key of the config
 * @param {string} value - The value of the config
 */
export function save(type: 'paths' | 'config', key: string, value: string): void {
  let info = JSON.parse(readFileSync(__dirname + `config\\${type}.json`, { encoding: 'utf8' }));

  info[key] = value;

  const string = JSON.stringify(info, null, 2);
  writeFileSync(__dirname + `config\\${type}.json`, string);
}

interface SpamAnalysis {
  [rule: string]: string;
}

interface SpamResult {
  totalPoints: number;
  analysis: SpamAnalysis;
}

/**
 * Parses the spam analysis from the log.txt file that SpamAssassin generates
 *
 * @remarks
 * This function takes the output that SpamAssassin generates and parses it into a
 * SpamResult object. The SpamResult object contains the total points and a
 * SpamAnalysis object that contains the rule and description for each rule.
 *
 * @example
 * // Returns { totalPoints: 5.1, analysis: { 'BAYES_50': 'BODY: Bayes spam probability is 50 to 60%'... } }
 * const spamResult = parseSpamAnalysis(emailText);
 *
 * @param {string} emailText - The log.txt file that SpamAssassin generates
 * @returns {SpamResult | null} - The result of the spam analysis
 */
export function parseSpamAnalysis(emailText: string): SpamResult | null {
  const startIndex: number = emailText.indexOf('Content analysis details:');
  if (startIndex === -1) {
    return null;
  }

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

// This function will take a SpamResult object and generate a PDF file using PDFKit (DON'T USE PASSTHROUGH())
/**
 * Generates a PDF file from a SpamResult object
 *
 * @remarks
 * This function takes a SpamResult object and generates a PDF file using PDFKit.
 * It then saves the PDF file to the user's desktop.
 *
 * @example
 * // Generates and saves a PDF file
 * generatePDF(spamResult);
 *
 * @param {SpamResult} spamResult - The result of the spam analysis
 *
 * @throws {Error} - If the PDF file could not be generated
 * @throws {Error} - If the PDF file could not be saved
 */
export function generatePDF(spamResult: SpamResult): void {
  const doc = new PDFDocument();
  const filePath = __dirname + 'temp\\report.pdf';

  doc.fontSize(25).text('Spam Analysis', {
    underline: true,
  });

  doc.fontSize(15).text(`Total Points: ${spamResult.totalPoints}`);

  doc.fontSize(15).text('Analysis:', {
    underline: true,
  });

  Object.keys(spamResult.analysis).forEach((key) => {
    doc.fontSize(15).text(`${key}: ${spamResult.analysis[key]}`);
  });

  doc.pipe(createWriteStream(filePath));
  doc.end();
}