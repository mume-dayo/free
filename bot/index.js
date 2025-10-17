import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildWebhooks,
  ],
});

// セッションストレージ（本番環境ではRedisなどを推奨）
const authSessions = new Map();

// 認証済みユーザーを保存（ユーザーIDとアクセストークンのマップ）
const authenticatedUsers = new Map();

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
    description: '認証済みユーザーを別のサーバーに参加させる',
    options: [
      {
        name: 'server_id',
        type: 3, // STRING type
        description: '参加させる先のサーバーID',
        required: true,
      },
    ],
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

client.once('ready', () => {
  console.log(`${client.user.tag}でログインしました`);
  registerCommands();
});

// Webhookチャンネルからのメッセージを監視
client.on('messageCreate', async (message) => {
  // Webhookからのメッセージのみ処理
  if (!message.webhookId) return;

  // 指定されたチャンネルからのWebhookのみ処理
  if (message.channelId !== process.env.WEBHOOK_CHANNEL_ID) return;

  try {
    // Webhookメッセージからデータを取得（JSON形式を想定）
    let data;
    try {
      data = JSON.parse(message.content);
    } catch (error) {
      console.error('Webhookメッセージのパースエラー:', error);
      return;
    }

    const { userId, sessionId, accessToken } = data;

    if (!userId || !sessionId) {
      console.error('userId or sessionId missing in webhook message');
      return;
    }

    const session = authSessions.get(sessionId);

    if (!session) {
      console.error(`Session not found: ${sessionId}`);
      return;
    }

    // アクセストークンを保存（別サーバー参加に使用）
    if (accessToken) {
      authenticatedUsers.set(userId, {
        accessToken,
        sessionId,
        authenticatedAt: Date.now(),
      });
      console.log(`ユーザー${userId}の認証情報を保存しました`);
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

    // Webhookメッセージを削除（オプション）
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
      .setTitle('🔐 サーバー認証')
      .setDescription(`このサーバーに参加するには、下のボタンから認証してください。\n\n**付与されるロール:** ${role}\n\n認証完了後、自動的にロールが付与されます。`)
      .setTimestamp();

    const oauthUrl = `${process.env.NETLIFY_URL}/auth?session=${sessionId}`;

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('認証する')
          .setStyle(ButtonStyle.Link)
          .setURL(oauthUrl)
          .setEmoji('✅')
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

    const targetServerId = interaction.options.getString('server_id');

    // 認証済みユーザーを取得
    if (authenticatedUsers.size === 0) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ エラー')
        .setDescription('認証済みのユーザーが見つかりませんでした。');
      return interaction.editReply({ embeds: [embed] });
    }

    // 対象サーバーが存在するか確認
    let targetGuild;
    try {
      targetGuild = await client.guilds.fetch(targetServerId);
    } catch (error) {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ エラー')
        .setDescription(`サーバーID \`${targetServerId}\` が見つかりませんでした。\nBotがそのサーバーに参加していることを確認してください。`);
      return interaction.editReply({ embeds: [embed] });
    }

    // 各ユーザーを別サーバーに参加させる
    let successCount = 0;
    let failCount = 0;
    const results = [];

    for (const [userId, userData] of authenticatedUsers.entries()) {
      try {
        const response = await fetch(
          `https://discord.com/api/v10/guilds/${targetServerId}/members/${userId}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: userData.accessToken,
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
      .setTitle('📢 別サーバーへの参加処理完了')
      .setDescription(`**対象サーバー:** ${targetGuild.name} (\`${targetServerId}\`)\n\n**結果:**\n成功: ${successCount}人\n失敗: ${failCount}人`)
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
