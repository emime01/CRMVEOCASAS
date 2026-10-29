import { Firestore, FieldValue } from '@google-cloud/firestore';
import { ExternalAccountClient, GoogleAuth } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';

export const COL = 'prospeccion_leads';
export const JOBS = 'prospeccion_jobs';
export const EXCL = 'prospeccion_excluidos';
export const META = 'prospeccion_meta';
export { FieldValue };

// Cómo se autentica contra Firestore, en orden:
// 1. FIREBASE_PRIVATE_KEY: clave de cuenta de servicio (la organización de Google hoy no deja crearlas).
// 2. GCP_WORKLOAD_IDENTITY_PROVIDER: en Vercel, sin claves. Google confía en el token OIDC de Vercel
//    y lo cambia por uno de la cuenta de servicio GCP_SERVICE_ACCOUNT_EMAIL.
// 3. Nada: credenciales por defecto de la máquina (gcloud auth application-default login).
function credenciales() {
  const { FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, GCP_WORKLOAD_IDENTITY_PROVIDER, GCP_SERVICE_ACCOUNT_EMAIL } = process.env;
  if (FIREBASE_PRIVATE_KEY) {
    return { credentials: { client_email: FIREBASE_CLIENT_EMAIL, private_key: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') } };
  }
  if (GCP_WORKLOAD_IDENTITY_PROVIDER) {
    const authClient = ExternalAccountClient.fromJSON({
      type: 'external_account',
      audience: `//iam.googleapis.com/${GCP_WORKLOAD_IDENTITY_PROVIDER}`,
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      token_url: 'https://sts.googleapis.com/v1/token',
      service_account_impersonation_url:
        `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
      subject_token_supplier: { getSubjectToken: () => getVercelOidcToken() },
    });
    return { auth: new GoogleAuth({ authClient }) };
  }
  return {};
}

let _db;
export function db() {
  // ignoreUndefinedProperties: Places y Serper devuelven campos faltantes como undefined (p. ej. website)
  return (_db ||= new Firestore({ projectId: process.env.FIREBASE_PROJECT_ID, ignoreUndefinedProperties: true, ...credenciales() }));
}
