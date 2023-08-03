import Enquirer from 'enquirer';
export var EnquireTypes;
(function (EnquireTypes) {
    EnquireTypes["select"] = "select";
    EnquireTypes["input"] = "input";
    EnquireTypes["confirm"] = "confirm";
})(EnquireTypes = EnquireTypes || (EnquireTypes = {}));
export var EnquireMessages;
(function (EnquireMessages) {
    EnquireMessages["confirm"] = "Confirm: ";
    EnquireMessages["project"] = "Enter the project's name: ";
    EnquireMessages["recipients"] = "Enter the recipients: ";
    EnquireMessages["supabaseKey"] = "Enter the supabase key: ";
    EnquireMessages["supabaseSecret"] = "Enter the supabase secret key: ";
    EnquireMessages["supabaseURL"] = "Enter the supabase URL: ";
    EnquireMessages["secretKey"] = "Enter a secret key that will be used to encrypt your credentials: ";
})(EnquireMessages = EnquireMessages || (EnquireMessages = {}));
export var EnquireNames;
(function (EnquireNames) {
    EnquireNames["confirm"] = "confirm";
    EnquireNames["project"] = "project";
    EnquireNames["recipients"] = "recipients";
    EnquireNames["supabaseKey"] = "supabaseKey";
    EnquireNames["supabaseSecret"] = "supabaseSecret";
    EnquireNames["supabaseURL"] = "supabaseURL";
    EnquireNames["secretKey"] = "secretKey";
})(EnquireNames = EnquireNames || (EnquireNames = {}));
export async function enquire(options) {
    return await Enquirer.prompt(options);
}
