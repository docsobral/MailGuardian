import { readdir } from 'node:fs/promises';
import selectFolder from 'win-select-folder';
import { resolve } from 'path';
import { __dirname } from '../api/filesystem.js';
import { ExifTool, Tags } from 'exiftool-vendored';

async function getMedia(path: string): Promise<string[]> {
  return await readdir(resolve(path, 'img'));
}

export async function getStats(path: string, exiftool: ExifTool): Promise<Tags[]> {
  const mediaPath = resolve(path, 'img');
  const media = await getMedia(path);

  let results: Tags[] = [];

  for (const file of media) {
    results.push(await exiftool.read(resolve(mediaPath, file)));
  }

  // results.push(await exiftool.read(path));

  return results;
}

export async function getHTMLStats(path: string, filename: string, exiftool: ExifTool): Promise<Tags> {
  return await exiftool.read(resolve(path, filename));
}

type FolderSelectOptions = {
  root: string;
  description: string;
  newFolder: number;
}

export async function getPath(): Promise<string> {
  const options: FolderSelectOptions = {
    root: 'Desktop',
    description: 'Find the template\'s directory:',
    newFolder: 0,
  }

  return await selectFolder(options);
}

export type FilteredTag = {
  SourceFile: string,
  Duration?: number,
  FileName: string,
  FileSize: string,
  FileType: string,
  ImageWidth: number,
}

export function filterMetadata(stats: Tags[]): FilteredTag[] {
  let filtered: FilteredTag[] = [];

  for (const file of stats) {
    const SourceFile = file.SourceFile ? file.SourceFile : '';
    const Duration = file.Duration;
    const FileName = file.FileName ? file.FileName : '';
    let FileSize = file.FileSize ? file.FileSize : '';
    const FileType = file.FileType ? file.FileType : '';
    const ImageWidth = file.ImageWidth ? file.ImageWidth : 0;

    if (FileSize.includes('MB')) {
      const number = Number(FileSize.replace(/ MB/, ''));
      FileSize = `${number * 1024} kB`;
    }

    filtered.push({
      SourceFile,
      Duration,
      FileName,
      FileSize,
      FileType,
      ImageWidth
    })
  }

  return filtered;
}

export function getTotalMediaWeight(stats: FilteredTag[]): number {
  let weight: number = 0;

  for (const file of stats) {
    const string = file.FileSize;
    const kilobytes = Number(string.replace(/ kB/, ''));

    weight += kilobytes;
  }

  return weight;
}

export function findGIFs(stats: FilteredTag[]): FilteredTag[] {
  let result: FilteredTag[] = [];

  for (const file of stats) {
    file.FileType === 'GIF' ? result.push(file) : null;
  }

  return result;
}