import { cookies } from 'next/headers';
import { getAccessTokenSecret, readAccessToken } from './auth';

export async function eventAccess() {
  const store = await cookies();
  return readAccessToken(store.get('access_level')?.value, getAccessTokenSecret(process.env.ACCESS_PASSWORD || '', process.env.ADMIN_PASSWORD || '', process.env.VIEWER_PASSWORD));
}
