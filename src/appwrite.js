import { Client, Databases, ID, Query } from 'appwrite';

const endpoint  = process.env.REACT_APP_APPWRITE_ENDPOINT;
const projectId = process.env.REACT_APP_APPWRITE_PROJECT_ID;

export const DB_ID     = process.env.REACT_APP_APPWRITE_DATABASE_ID;
export const PARTS     = 'parts';
export const TXNS      = 'transactions';
export const configured = Boolean(endpoint && projectId && DB_ID);

const client = new Client();
if (configured) client.setEndpoint(endpoint).setProject(projectId);

export const db = new Databases(client);
export { client, ID, Query };
