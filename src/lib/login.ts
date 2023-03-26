import chalk from 'chalk';
import { getState, saveState } from "./save.js";
import { enquire, PromptTypes, PromptNames, PromptMessages } from "../api/enquire.js";
import { createTransporter, TransporterOptions, TransporterType } from "../api/nodemailer.js";

export async function isLoggedIn(id: string, password: string) {
  const state = await getState();

  if (state.logged[0]) {
    console.log('You are already logged in... do you want to change accounts?');
    const { confirm } = await enquire([
      {
        type: PromptTypes.confirm,
        name: PromptNames.confirm,
        message: PromptMessages.confirm
      }
    ]);

    if (confirm) {
      login(id, password);
    } else {
      return
    }
  } else {
    login(id, password);
  }
}

export async function login(id: string, password: string) {
  console.log(`${chalk.blue('Logging in...')}`);

  if (id.includes('gmail')) {
    const options: TransporterOptions = {
      host: 'smtp.gmail.com',
      id,
      password
    }

    let transporter: TransporterType;

    transporter = await createTransporter(options);
    transporter.verify(error => {
      if (error) {
        console.log(error);
      } else {
        console.log(`${chalk.blueBright('Success! Saving your credentials')}`);
        saveCredentials(options);
        saveCredentials({logged: true});
      }
    });
  }
}

export async function saveCredentials(options: any) {
  Object.keys(options).forEach(key => {
    (key === 'id' || key === 'password') ? saveState(key, options[key], true) : saveState(key, options[key]);
  });
}

export async function checkLoggedBeforeMail() {
  const state = await getState();
  return state.logged[0]
}