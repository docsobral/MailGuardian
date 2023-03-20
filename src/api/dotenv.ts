import dotenv from 'dotenv';

dotenv.config();

type EnvParameters = {
  port?: string;
  supaKey?: string;
  supaSecret?: string;
  supaUrl?: string;
  secretKey?: string;
  author?: string;
}

const env: EnvParameters = {
  port: process.env.port,
  supaKey: process.env.supa_key,
  supaSecret: process.env.supa_secret,
  supaUrl: process.env.supa_url,
  secretKey: process.env.secret_key,
  author: process.env.author,
};

export default env;