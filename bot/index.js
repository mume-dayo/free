import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// データファイルのパス
const DATA_DIR = path.join(__dirname, 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// セッションストレージ（本番環境ではRedisなどを推奨）
const authSessions = new Map();

// 認証済みユーザーを保存（ユーザーIDとアクセストークンのマップ）
const authenticatedUsers = new Map();

// データを保存する関数
async function saveData() {
  try {
    // dataディレクトリが存在しない場合は作成
    await fs.mkdir(DATA_DIR, { recursive: true });

    // セッションデータを保存
    const sessionsData = Array.from(authSessions.entries());
    await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessionsData, null, 2));

    // 認証ユーザーデータを保存
    const usersData = Array.from(authenticatedUsers.entries());
    await fs.writeFile(USERS_FILE, JSON.stringify(usersData, null, 2));

    console.log('データを保存しました');
  } catch (error) {
    console.error('データ保存エラー:', error);
  }
}

// データを読み込む関数
async function loadData() {
  try {
    // セッションデータを読み込み
    try {
      const sessionsData = await fs.readFile(SESSIONS_FILE, 'utf-8');
      const sessions = JSON.parse(sessionsData);
      sessions.forEach(([key, value]) => authSessions.set(key, value));
      console.log(`${sessions.length}件のセッションを読み込みました`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('セッション読み込みエラー:', error);
      }
    }

    // 認証ユーザーデータを読み込み
    try {
      const usersData = await fs.readFile(USERS_FILE, 'utf-8');
      const users = JSON.parse(usersData);
      users.forEach(([key, value]) => authenticatedUsers.set(key, value));
      console.log(`${users.length}人の認証ユーザーを読み込みました`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('ユーザー読み込みエラー:', error);
      }
    }
  } catch (error) {
    console.error('データ読み込みエラー:', error);
  }
}

// アクセストークンをリフレッシュする関数
async function refreshAccessToken(userId) {
  const userData = authenticatedUsers.get(userId);
  if (!userData || !userData.refreshToken) {
    console.error(`ユーザー${userId}のリフレッシュトークンが見つかりません`);
    return null;
  }

  try {
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: userData.refreshToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`トークンリフレッシュエラー (${userId}):`, data);
      return null;
    }

    // 新しいトークンで更新
    authenticatedUsers.set(userId, {
      ...userData,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      refreshedAt: Date.now(),
    });

    await saveData();
    console.log(`ユーザー${userId}のアクセストークンを更新しました`);
    return data.access_token;
  } catch (error) {
    console.error(`トークンリフレッシュエラー (${userId}):`, error);
    return null;
  }
}

// 定期的にデータを保存（5分ごと）
setInterval(saveData, 5 * 60 * 1000);

// コマンド登録
const commands = [
  {
    name: 'button',
    description: 'OAuth認証パネルを作成してロールを付与',
    options: [
      {
        name: 'role',
        type: 8, // ROLE type
        description: '付与するロール',
        required: true,
      },
    ],
  },
  {
    name: 'call',
    description: '認証済みユーザーをこのサーバーに参加させる',
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

async function registerCommands() {
  try {
    console.log('スラッシュコマンドを登録中...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: commands }
    );
    console.log('スラッシュコマンドの登録完了');
  } catch (error) {
    console.error('コマンド登録エラー:', error);
  }
}

client.once('ready', async () => {
  console.log(`${client.user.tag}でログインしました`);

  // 保存されたデータを読み込み
  await loadData();

  registerCommands();
});

// 認証通知チャンネルからのメッセージを監視
client.on('messageCreate', async (message) => {
  // 自分のBotからのメッセージのみ処理
  if (message.author.id !== client.user.id) return;

  // 指定されたチャンネルからのメッセージのみ処理
  if (message.channelId !== process.env.WEBHOOK_CHANNEL_ID) return;

  try {
    // Botメッセージからデータを取得（JSON形式を想定）
    let data;
    try {
      data = JSON.parse(message.content);
    } catch (error) {
      console.error('メッセージのパースエラー:', error);
      return;
    }

    const { userId, sessionId, accessToken, refreshToken, expiresIn } = data;

    if (!userId || !sessionId) {
      console.error('userId or sessionId missing in webhook message');
      return;
    }

    const session = authSessions.get(sessionId);

    if (!session) {
      console.error(`Session not found: ${sessionId}`);
      return;
    }

    // アクセストークンとリフレッシュトークンを保存
    if (accessToken) {
      authenticatedUsers.set(userId, {
        accessToken,
        refreshToken: refreshToken || null,
        sessionId,
        authenticatedAt: Date.now(),
        expiresAt: expiresIn ? Date.now() + (expiresIn * 1000) : null,
      });
      console.log(`ユーザー${userId}の認証情報を保存しました`);

      // データを永続化
      await saveData();
    }

    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);

    // ユーザーがサーバーにいるか確認
    let member;
    try {
      member = await guild.members.fetch(userId);
    } catch (error) {
      console.error(`User ${userId} not found in guild`);
      return;
    }

    // ロールを付与
    if (session.roleId) {
      try {
        await member.roles.add(session.roleId);
        console.log(`ユーザー${userId}にロール${session.roleId}を付与しました`);
      } catch (error) {
        console.error('ロール付与エラー:', error);
        return;
      }
    }

    // パネルメッセージを更新
    if (session.messageId && session.channelId) {
      try {
        const channel = await client.channels.fetch(session.channelId);
        const panelMessage = await channel.messages.fetch(session.messageId);

        const currentEmbed = panelMessage.embeds[0];
        const authenticatedUsersText = currentEmbed.description.includes('認証済みユーザー:')
          ? currentEmbed.description
          : currentEmbed.description + '\n\n**認証済みユーザー:**';

        const updatedEmbed = EmbedBuilder.from(currentEmbed)
          .setDescription(`${authenticatedUsersText}\n• <@${userId}>`);

        await panelMessage.edit({ embeds: [updatedEmbed] });
      } catch (error) {
        console.error('メッセージ更新エラー:', error);
      }
    }

    // 処理完了後、メッセージを削除（オプション）
    await message.delete().catch(() => {});
  } catch (error) {
    console.error('Webhook処理エラー:', error);
  }
});

// /button コマンド
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'button') {
    if (!interaction.memberPermissions.has('Administrator')) {
      return interaction.reply({ content: 'このコマンドは管理者のみ使用できます。', ephemeral: true });
    }

    const role = interaction.options.getRole('role');
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // セッション情報を保存
    authSessions.set(sessionId, {
      roleId: role.id,
      channelId: interaction.channelId,
      messageId: null,
      createdAt: Date.now(),
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('にんしょーだよ！')
      .setDescription('以下のリンクから認証。')
      .setTimestamp();

    const oauthUrl = `${process.env.NETLIFY_URL}/auth?session=${sessionId}`;

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('認証する')
          .setStyle(ButtonStyle.Link)
          .setURL(oauthUrl)
      );

    const message = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true
    });

    // メッセージIDを保存
    const session = authSessions.get(sessionId);
    session.messageId = message.id;
    authSessions.set(sessionId, session);

    // 24時間後にセッションを削除
    setTimeout(() => {
      authSessions.delete(sessionId);
    }, 24 * 60 * 60 * 1000);
  }

  if (interaction.commandName === 'call') {
    if (!interaction.memberPermissions.has('Administrator')) {
      return interaction.reply({ content: 'このコマンドは管理者のみ使用できます。', ephemeral: true });
    }

    await interaction.deferReply();

    // 現在のサーバーIDを取得
    const targetServerId = interaction.guildId;

    // 認証済みユーザーを取得
    if (authenticatedUsers.size === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ エラー')
        .setDescription('認証済みのユーザーが見つかりませんでした。');
      return interaction.editReply({ embeds: [embed] });
    }

    // 現在のサーバーを取得
    const targetGuild = interaction.guild;

    // 各ユーザーをこのサーバーに参加させる
    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (const [userId, userData] of authenticatedUsers.entries()) {
      try {
        // トークンが期限切れの場合はリフレッシュ
        let accessToken = userData.accessToken;
        if (userData.expiresAt && Date.now() >= userData.expiresAt) {
          console.log(`ユーザー${userId}のトークンが期限切れです。リフレッシュします...`);
          const newToken = await refreshAccessToken(userId);
          if (!newToken) {
            failCount++;
            results.push(`❌ <@${userId}> - トークンの更新に失敗`);
            continue;
          }
          accessToken = newToken;
        }

        const response = await fetch(
          `https://discord.com/api/v10/guilds/${targetServerId}/members/${userId}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: accessToken,
            }),
          }
        );

        if (response.ok || response.status === 204) {
          successCount++;
          results.push(`✅ <@${userId}>`);
          console.log(`ユーザー${userId}をサーバー${targetServerId}に追加しました`);
        } else {
          const errorData = await response.json();
          failCount++;
          results.push(`❌ <@${userId}> - ${errorData.message || 'エラー'}`);
          console.error(`ユーザー${userId}の追加に失敗:`, errorData);
        }
      } catch (error) {
        failCount++;
        results.push(`❌ <@${userId}> - ネットワークエラー`);
        console.error(`ユーザー${userId}の追加に失敗:`, error);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(successCount > 0 ? 0x43B581 : 0xFF0000)
      .setTitle('📢 サーバー参加処理完了')
      .setDescription(`**対象サーバー:** ${targetGuild.name}\n\n**結果:**\n成功: ${successCount}人\n失敗: ${failCount}人`)
      .addFields({
        name: '詳細',
        value: results.length > 0 ? results.slice(0, 20).join('\n') : 'なし',
      })
      .setTimestamp();

    if (results.length > 20) {
      embed.setFooter({ text: `他 ${results.length - 20} 件の結果があります` });
    }

    await interaction.editReply({ embeds: [embed] });
  }
});

// エラーハンドリング
client.on('error', console.error);
process.on('unhandledRejection', console.error);

client.login(process.env.DISCORD_BOT_TOKEN);
