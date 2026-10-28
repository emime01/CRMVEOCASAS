// Obtiene el refresh token de la casilla que va a enviar. Uso: npm run gmail-token
import http from 'node:http';
import { google } from 'googleapis';

const PUERTO = 3333;
const oauth = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, `http://localhost:${PUERTO}`);
const url = oauth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: ['https://www.googleapis.com/auth/gmail.modify'] });

console.log('\nAbrí esta URL logueado con la casilla que envía (SENDER_EMAIL):\n\n' + url + '\n');
http.createServer(async (req, res) => {
  const code = new URL(req.url, `http://localhost:${PUERTO}`).searchParams.get('code');
  if (!code) return res.end('Esperando código…');
  const { tokens } = await oauth.getToken(code);
  res.end('Listo, podés cerrar esta pestaña.');
  console.log('GMAIL_REFRESH_TOKEN=' + tokens.refresh_token + '\n');
  process.exit(0);
}).listen(PUERTO);
