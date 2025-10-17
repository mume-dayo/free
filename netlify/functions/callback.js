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
  const redirectUri = process.env.REDIRECT_URI;
  const guildId = process.env.DISCORD_GUILD_ID;

  try {
    // Step 1: Exchange code for access token
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
        body: JSON.stringify({ error: 'Failed to exchange authorization code' }),
      };
    }

    const { access_token } = tokenData;

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

    // Step 3: Add user to guild using bot token
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const addMemberResponse = await fetch(
      `https://discord.com/api/guilds/${guildId}/members/${userId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: access_token,
        }),
      }
    );

    // 201 = created, 204 = already in guild
    if (!addMemberResponse.ok && addMemberResponse.status !== 204) {
      const errorData = await addMemberResponse.json();
      console.error('Add member error:', errorData);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to add user to guild' }),
      };
    }

    // Step 4: Send data to Discord Webhook (Botが監視しているチャンネル)
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (discordWebhookUrl) {
      try {
        const webhookData = {
          userId: userId,
          sessionId: sessionId,
          accessToken: access_token,
        };

        await fetch(discordWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: JSON.stringify(webhookData),
          }),
        });
      } catch (webhookError) {
        console.error('Discord Webhook error:', webhookError);
        // Continue even if webhook fails
      }
    } else {
      console.warn('DISCORD_WEBHOOK_URL not set, skipping webhook notification');
    }

    // Step 5: Redirect to success page
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
