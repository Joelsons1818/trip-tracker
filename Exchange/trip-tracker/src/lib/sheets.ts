import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

export async function getGoogleSheets() {
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || '';
  const formatedKey = rawKey.replace(/^"|"$/g, '').replace(/\\n/g, '\n');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL?.replace(/^"|"$/g, ''),
      private_key: formatedKey,
    },
    scopes: SCOPES,
  });

  const client = await auth.getClient();
  return google.sheets({ version: 'v4', auth: client as any });
}
