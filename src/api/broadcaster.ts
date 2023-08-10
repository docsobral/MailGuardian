import chalk from "chalk";
import ora, { Ora } from "ora";

export class Broadcaster {
  _spinner: Ora | undefined;
  _process: typeof process;

  constructor() {
    this._process = process;
  }

  set text(text: string) {
    if (this._spinner) {
      this._spinner.text = text;
      return;
    }
  }

  get text() {
    if (this._spinner) {
      return this._spinner.text;
    }

    throw new Error('Start the spinner first...');
  }

  color(text: string, color: 'yellow' | 'blue' | 'green' | 'red'){
    let colorer;

    switch (color) {
      case 'red':
        colorer = chalk.red;
        break;
      case 'yellow':
        colorer = chalk.yellow;
        break;
      case 'blue':
        colorer = chalk.blue;
        break;
      case 'green':
        colorer = chalk.green;
        break;
    }

    return colorer(text);
  }

  appendSuffix(text: string, color: 'yellow' | 'blue' | 'green' | 'red') {
    if (this._spinner) {
      let colorer;

      switch (color) {
        case 'red':
          colorer = chalk.red;
          break;
        case 'yellow':
          colorer = chalk.yellow;
          break;
        case 'blue':
          colorer = chalk.blue;
          break;
        case 'green':
          colorer = chalk.green;
          break;
      }

      this._spinner.suffixText += colorer(text);
    }
  }

  append(text: string, color: 'red' | 'yellow' | 'green' | 'blue', linebreak: boolean = true) {
    if (this._spinner) {
      let colorer;

      switch (color) {
        case 'red':
          colorer = chalk.red;
          break;
        case 'yellow':
          colorer = chalk.yellow;
          break;
        case 'blue':
          colorer = chalk.blue;
          break;
        case 'green':
          colorer = chalk.green;
          break;
      }

      const prefix = linebreak ? '\n' : '';
      const toAppend = prefix + text;

      this.text += colorer(toAppend);
    }
  }

  set(text: string, color: 'red' | 'yellow' | 'green' | 'blue') {
    if (this._spinner) {
      let colorer;

      switch (color) {
        case 'red':
          colorer = chalk.red;
          break;
        case 'yellow':
          colorer = chalk.yellow;
          break;
        case 'blue':
          colorer = chalk.blue;
          break;
        case 'green':
          colorer = chalk.green;
          break;
      }

      this.text = colorer(text);
    }
  }

  start(text: string) {
    this.log('\n');
    const yellowText = chalk.yellow(text);
    this._spinner = ora(yellowText).start();
  }

  succeed(text?: string) {
    if (this._spinner) {
      if (text) {
        const yellowText = chalk.yellow(text);
        this._spinner.succeed(yellowText);
      } else {
        this._spinner.succeed();
      }
      return;
    }
  }

  fail(text?: string) {
    if (this._spinner) {
      const redText = chalk.red(text);
      this._spinner.fail(redText);
      return;
    }
  }

  log(text: string) {
    this._process.stdout.write(text);
  }

  logSeries(array: [string, 'yellow' | 'blue' | 'green' | 'red'][]) {
    let string: string = '';
    let colorer;

    array.forEach(part => {
      const text = part[0];
      const color = part[1];

      switch (color) {
        case 'red':
          colorer = chalk.red;
          break;
        case 'yellow':
          colorer = chalk.yellow;
          break;
        case 'blue':
          colorer = chalk.blue;
          break;
        case 'green':
          colorer = chalk.green;
          break;
      }

      string += colorer(text);
    });

    this._process.stdout.write(string + '\n');
  }

  warn(text: string) {
    this._process.stdout.write(chalk.red(text) + '\n');
  }

  inform(text: string) {
    this._process.stdout.write(chalk.yellow(text) + '\n');
  }

  calm(text: string) {
    this._process.stdout.write(chalk.blueBright(text) + '\n');
  }

  error(text: string) {
    throw new Error(chalk.red(text));
  }
}