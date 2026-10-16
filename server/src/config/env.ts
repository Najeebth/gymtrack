import dotenv from 'dotenv';

dotenv.config();

export const PORT = process.env.PORT || 4000;
export const JWT_SECRET = process.env.JWT_SECRET || 'gymtrack_super_secret_key';
export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
export const NODE_ENV = process.env.NODE_ENV || 'development';

export const B2_ACCESS_KEY_ID = process.env.B2_ACCESS_KEY_ID || '';
export const B2_SECRET_ACCESS_KEY = process.env.B2_SECRET_ACCESS_KEY || '';
export const B2_REGION = process.env.B2_REGION || 'us-east-005';
export const B2_BUCKET = process.env.B2_BUCKET || '';
export const B2_ENDPOINT = process.env.B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com';
export const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
