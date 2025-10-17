export async function handler(event, context) {
  const { session } = event.queryStringParameters || {};

  if (!session) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Session ID is required' }),
    };
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.REDIRECT_URI;

  // OAuth2認証URLを生成
  const authUrl = new URL('https://discord.com/api/oauth2/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'identify guilds.join');
  authUrl.searchParams.set('state', session);

  return {
    statusCode: 302,
    headers: {
      Location: authUrl.toString(),
    },
  };
}
