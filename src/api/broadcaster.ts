import ora, { Ora } from "ora";

export class Broadcaster {
  _spinner: Ora;
  _process: typeof process;

  constructor() {
    this._spinner = ora();
    this._process = process;
  }

  setSpinner(text?: string) {
    this._spinner = ora(text);
  }

  set text(text: string) {
    if (this._spinner) {
      this._spinner.text = text;
      return;
    }
  }

  append(text: string) {
    if (this._spinner) {
      this._spinner.text += text;
    }
  }

  start(text?: string) {
    if (this._spinner) {
      this.logToConsole('\n');
      this._spinner.start(text);
      return;
    }
  }

  succeed(text?: string) {
    if (this._spinner) {
      this._spinner.succeed(text);
      this.logToConsole('\n');
      return;
    }
  }

  fail(text?: string) {
    if (this._spinner) {
      this._spinner.fail(text);
      this.logToConsole('\n');
      return;
    }
  }

  logToConsole(text: string) {
    this._process.stdout.write(text);
  }
}

// async function delay(ms: number): Promise<void> {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }