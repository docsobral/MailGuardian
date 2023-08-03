import { getState, saveState } from "../api/filesystem.js";
import { createTransporter } from "../api/nodemailer.js";
export async function isLoggedIn() {
    const state = await getState();
    if (state.logged[0])
        return true;
    else
        return false;
}
function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}
;
export async function login(id, password) {
    if (id.includes('gmail')) {
        const options = {
            host: 'smtp.gmail.com',
            id,
            password
        };
        let transporter;
        transporter = await createTransporter(options);
        transporter.verify(error => {
            if (error) {
                console.log(error);
            }
            else {
                saveCredentials(options);
                saveCredentials({ logged: true });
            }
        });
    }
    await delay(5000);
    return await isLoggedIn();
}
export async function saveCredentials(options) {
    Object.keys(options).forEach(key => {
        (key === 'id' || key === 'password') ? saveState(key, options[key], true) : saveState(key, options[key]);
    });
}
