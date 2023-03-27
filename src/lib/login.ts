import { getState, saveState } from "./save.js";
import { createTransporter, TransporterOptions, TransporterType } from "../api/nodemailer.js";

export async function isLoggedIn() {
  const state = await getState();
  if (state.logged[0]) return true;
  else return false;
}

function delay(time: number) {
  return new Promise(resolve => setTimeout(resolve, time));
};

export async function login(id: string, password: string) {
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
        // console.log(`${chalk.blueBright('Success! Saving your credentials')}`);
        saveCredentials(options);
        saveCredentials({logged: true});
      }
    });
  }

  await delay(5000);

  return await isLoggedIn();
}

export async function saveCredentials(options: any) {
  Object.keys(options).forEach(key => {
    (key === 'id' || key === 'password') ? saveState(key, options[key], true) : saveState(key, options[key]);
  });
}