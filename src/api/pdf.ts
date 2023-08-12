import {
  getStats,
  getHTMLStats,
  filterMetadata,
  FilteredTag,
  getTotalMediaWeight,
  findGIFs,
  getPath
} from '../lib/filestats.js';
import { createWriteStream } from 'node:fs';
import { Tags, ExifTool } from 'exiftool-vendored';
import PDFDocument from 'pdfkit';
import { resolve } from 'node:path';
import { __dirname } from './filesystem.js';

interface SpamAnalysis {
  [rule: string]: [string, string];
}

interface SpamResult {
  totalPoints: number;
  analysis: SpamAnalysis;
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
export async function generatePDF(spamResult: SpamResult): Promise<void> {
  const path: string = resolve(__dirname, 'temp\\spam-analysis.pdf');

  function scoreString(score: number): [string, string, string] {
    switch (true) {
      case score >= 6: return ['This email will ', 'DEFINITELY', ' be flagged as spam'];
      case score >= 5: return ['This email will ', 'MOST LIKELY', ' be flagged as spam'];
      case score >= 4: return ['Very strict spam filters ', 'MAY', ' flag this email as spam'];
      default: return ['This email is ', 'UNLIKELY', ' to be flagged as spam'];
    }
  }

  function scoreSize(size: number): [string, string, string] {
    if (size >= 98) {
      return ['This email will ', 'DEFINITELY', ' be cropped by gmail'];
    }

    else if (size >= 95) {
      return ['This email will ', 'MOST LIKELY', ' be cropped by gmail'];
    }

    return ['This email ', 'WON\'T', ' be cropped by gmail'];
  }

  function scoreWeight(imgsWeight: number, htmlWeight: number): string[] {
    const totalWeight = (imgsWeight + htmlWeight) / 1024;
    let stringArray = ['The total loaded email weight ', `(aprox. ${(imgsWeight / 1024).toFixed(1)} MB)`];
    if (totalWeight >= 3) {
      stringArray.push(' will ', 'definitely', ' affect the user experience!')
      return stringArray;
    }

    else if (totalWeight >= 1) {
      stringArray.push(' may ', 'affect', ' the user experience.');
      return stringArray;
    }

    else {
      stringArray.push(' will ', 'not', ' affect the user experience.')
      return stringArray;
    }
  }

  function stringColor(number: number, type: 'spam' | 'size' | 'totalweight', htmlWeight?: number): [number, number, number] {
    if (type === 'spam') {
      switch (true) {
        case number >= 5: return [255, 27, 120];
        case number >= 4: return [255, 240, 17];
        default: return [0, 189, 250];
      }
    }

    else if (type === 'size') {
      switch (true) {
        case number >= 98: return [255, 27, 120];
        case number >= 95: return [255, 240, 17];
        default: return [0, 189, 250];
      }
    }

    let totalWeight: number = 0;
    if (htmlWeight) {
      totalWeight = (number + htmlWeight) / 1024;
    }

    switch (true) {
      case totalWeight >= 3: return [255, 27, 120];
      case totalWeight >= 1: return [255, 240, 17];
      default: return [0, 189, 250];
    }
  }

  function centerString(number: number, type: 'spam' | 'size'): string {
    if (type === 'spam') {
      switch (true) {
        case number >= 6: return ' '.repeat(21);
        case number >= 5: return ' '.repeat(20);
        case number >= 4: return ' '.repeat(14);
        default: return ' '.repeat(22);
      }
    }

    switch (true) {
      case number >= 95: return ' '.repeat(19);
      default: return ' '.repeat(29);
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
      case 1: return day === 11 ? 'th' : 'st';
      case 2: return day === 12 ? 'th' : 'nd';
      case 3: return day === 13 ? 'th' : 'rd';
      default: return 'th';
    }
  }

  const currentDate = new Date();
  const day = currentDate.getDate();
  const month = currentDate.toLocaleDateString('en-uk', { month: 'long' });
  const year = currentDate.getFullYear();

  doc.fontSize(12).text('Delivery Performance', {align: 'center'});
  doc.moveDown(3);
  doc.fontSize(15).text(`Email Analysis | ${day}${daySuffix(day)} of ${month}, ${year}`, {align: 'center'});
  doc.moveDown(2);
  doc.fontSize(15)
    .text(`${centerString(spamResult.totalPoints, 'spam')}${diagnosis[0]}`, {continued: true})
    .fillColor(stringColor(spamResult.totalPoints, 'spam'))
    .text(`${diagnosis[1]}`, {continued: true})
    .fillColor('black')
    .text(`${diagnosis[2]}`, {continued: false})

  doc.moveDown();

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

  doc.moveDown(2);

  const exiftool = new ExifTool();

  const pathToGif = resolve(await getPath());
  const stats = await getStats(pathToGif, exiftool);
  let HTMLStats: Tags | FilteredTag = await getHTMLStats(pathToGif, 'index.html', exiftool);

  exiftool.end();
  stats.unshift(HTMLStats);

  const filteredStats = filterMetadata(stats);

  const fileSizeString = filteredStats[0].FileSize;
  const fileSize = Number(fileSizeString.replace(/kB/, ''));
  const sizeDiagnosis = scoreSize(fileSize);

  doc.fontSize(15)
  .text(`${centerString(fileSize, 'size')}${sizeDiagnosis[0]}`, {continued: true})
  .fillColor(stringColor(fileSize, 'size'))
  .text(`${sizeDiagnosis[1]}`, {continued: true})
  .fillColor('black')
  .text(`${sizeDiagnosis[2]}`, {continued: false});

  doc.moveDown();

  doc.fillColor('black').fontSize(12).text(
    `Gmail crops all emails over 102 kB (aprox. 0.1 MB). This email's HTML weighs `, {
      continued: true,
      align: 'justify',
    }
  ).fillColor(stringColor(fileSize, 'size')).text(`${(fileSize).toFixed(1)} kilobytes`, {
      continued: true,
    }
  ).fillColor('black').text(', which means that ', {
      continued: true,
      underline: false,
  }
  ).text(`${(sizeDiagnosis[0] + sizeDiagnosis[1] + sizeDiagnosis[2]).toLowerCase()}`, {
      continued: true,
      underline: true
  }
  ).text('. Even if the HTML\'s size is below 102 kB, there is a chance it could be cropped anyway. That is because the file that Gmail (and any other email client) receives is not the HTML, but a MIME file (Multipurpose Internet Mail Extensions), which includes all of the code inside the HTML plus extra data (header information, security data etc) which can add up over 102 kB.', {
    continued: false,
    underline: false,
  });

  doc.moveDown(2);

  const mediaStats: FilteredTag[] = filteredStats.slice(1);
  const mediaWeight: number = getTotalMediaWeight(mediaStats);
  const stringArray: string[] = scoreWeight(mediaWeight, fileSize);
  const weightColor: [number, number, number] = stringColor(mediaWeight, 'totalweight', fileSize);

  doc.fontSize(15).text('Extra important information:');

  doc.moveDown();

  doc.fontSize(12).text(stringArray[0], { continued: true }).fillColor(weightColor).text(stringArray[1], { continued: true }).fillColor('black').text(stringArray[2], { continued: true }).fillColor(weightColor).text(stringArray[3], { continued: true }).fillColor('black').text(stringArray[4], { continued: false });

  const gifs = findGIFs(mediaStats);

  const durations: number[] = gifs.map(file => file.Duration as number);

  // for (const duration of durations) {
  //   doc.text(duration.toString() + ' ')
  // }

  if (durations.filter(duration => duration >= 31).length !== 0) {
    doc.text('One of the GIF lasts for ', { continued: true }).fillColor([255, 27, 120]).text('longer than 30 seconds', { continued: true }).fillColor('black').text(', which means it will Gmail will not load it.', { continued: false });
  }

  doc.end();
}