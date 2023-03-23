import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = dirname(fileURLToPath(import.meta.url));

function escapeSlashesAndSpaces(path: string) {
  const pathArray = path.split('');
  let newArray = [];

  for (let char of pathArray) {
    char !== '\\' ? newArray.push(char) : newArray.push('\\\\');
  };

  return newArray.join('');
};

const __dirname = escapeSlashesAndSpaces(__filename.split('build')[0]);

export default __dirname;