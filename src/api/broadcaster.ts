import chalk from "chalk";
import ora, { Ora } from "ora";
import Enquirer from "enquirer";

interface EnquireOptions {
  type: string,
  name: string,
  message: string,
  initial?: string,
  choices?: string[],
  multiple?: boolean,
  result?(value: string | string[]): string | Promise<string>,
}

type EnquireAnswer = {
  [name: string]: any;
}

export class Broadcaster implements Partial<Console> {
  _spinner: Ora | undefined;
  _enquirer: Enquirer;
  _process: typeof process;
  _indent: number;

  constructor() {
    this._indent = 0;
    this._process = process;
    this._enquirer = new Enquirer();
  }

  clear = console.clear.bind(this);

  set text(text: string) {
    if (this._spinner) {
      this._spinner.text = text;
      return;
    }
  }

  set prefix(text: string) {
    if (this._spinner) {
      this._spinner.prefixText = text;
    }
  }

  set indent(number: number) {
    if (this._spinner) {
      this._spinner.indent = number;
    }

    this._indent = number;
  }

  get text() {
    if (this._spinner) {
      return this._spinner.text;
    }

    throw new Error('Start the spinner first...');
  }

  get enquirer() {
    return this._enquirer;
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
    const yellowText = chalk.yellow(text);
    this._spinner = ora(yellowText);
    this.prefix = '\n';
    this._spinner.start();
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

  log(text?: string) {
    const toPrint = text ? text : '';
    this._process.stdout.write(''.repeat(this.indent) + toPrint + '\n');
  }

  logSeries(array: [string, 'yellow' | 'blue' | 'green' | 'red' | undefined][]) {
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
        default:
          colorer = chalk.white;
      }

      string += colorer(text);
    });

    this._process.stdout.write(''.repeat(this.indent) + string + '\n');
  }

  warn(text: string) {
    this._process.stdout.write(''.repeat(this.indent) + chalk.red(text) + '\n');
  }

  inform(text: string) {
    this._process.stdout.write(''.repeat(this.indent) + chalk.yellow(text) + '\n');
  }

  calm(text: string) {
    this._process.stdout.write(''.repeat(this.indent) + chalk.blueBright(text) + '\n');
  }

  error(text: string) {
    throw new Error(chalk.red(text));
  }

  solve(text: string) {
    this._process.stdout.write(''.repeat(this.indent) + chalk.blue(text) + '\n');
  }

  async ask(questions: EnquireOptions[]): Promise<EnquireAnswer> {
    const answer = await this._enquirer?.prompt(questions);

    return answer as EnquireAnswer;
  }
}