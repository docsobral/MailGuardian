import { getState, saveState } from "../state/save.js";
import { enquire, PromptTypes, PromptNames, PromptMessages } from "../api/enquire.js";
import { createTransporter, TransporterOptions, TransporterType } from "../api/nodemailer.js";

export async function isLoggedIn(id: string, password: string) {
  const state = getState();

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

type Hosts = {
  [host: string]: string;
}

const hosts: Hosts = {
  'Gmail': 'smtp.gmail.com',
  'Apple': '',
  'Outlook': '',
}

export async function login(id: string, password: string) {
  console.log('Logging in...');
  const { host } = await enquire([
    {
      type: PromptTypes.select,
      name: PromptNames.host,
      message: PromptMessages.host,
      choices: ['Gmail', 'Apple', 'Outlook']
    }
  ]);

  if (typeof host === 'string') {
    const hostUrl = hosts[host];
    const options: TransporterOptions = {
      host: hostUrl,
      id,
      password
    }

    let transporter: TransporterType;

    transporter = await createTransporter(options);
    transporter.verify(error => {
      if (error) {
        console.log(error);
      } else {
        console.log('Success! Saving your credentials');
        saveCredentials(options);
      }
    });
  }
}

export async function saveCredentials(options: any) {
  Object.keys(options).forEach(key => {
    (key === 'id' || key === 'password') ? saveState(key, options[key], true) : saveState(key, options[key]);
  });
}