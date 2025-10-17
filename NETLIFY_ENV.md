# Netlify環境変数設定

Netlifyにデプロイする際に設定が必要な環境変数の一覧です。

## 必須環境変数 (6つ)

以下の環境変数をNetlifyの管理画面で設定してください:

**Site settings** → **Environment variables** → **Add a variable**

### 1. Discord Bot Configuration

```
DISCORD_BOT_TOKEN=your_bot_token_here
```
- Discord Botのトークン
- Netlify FunctionsがDiscordチャンネルにメッセージを送信するために使用
- Discord Developer Portal → Bot → Token からコピー

```
DISCORD_CLIENT_ID=your_client_id_here
```
- Discord ApplicationのClient ID
- OAuth2認証に使用
- Discord Developer Portal → OAuth2 → Client ID からコピー

```
DISCORD_CLIENT_SECRET=your_client_secret_here
```
- Discord ApplicationのClient Secret
- OAuth2認証に使用
- Discord Developer Portal → OAuth2 → Client Secret からコピー

### 2. Notification Channel Configuration

```
WEBHOOK_CHANNEL_ID=your_notification_channel_id_here
```
- 認証通知を受け取るDiscordチャンネルのID
- チャンネルを右クリック → IDをコピー
- このチャンネルにNetlifyがBotとしてメッセージを送信します

### 3. Netlify Configuration

```
NETLIFY_URL=https://niggered.netlify.app
```
- NetlifyでデプロイされたサイトのURL
- このプロジェクトのURL: `https://niggered.netlify.app`

```
REDIRECT_URI=https://niggered.netlify.app/.netlify/functions/callback
```
- OAuth2のコールバックURL
- `NETLIFY_URL`に`/.netlify/functions/callback`を追加したもの
- Discord Developer Portal → OAuth2 → Redirects にも`https://niggered.netlify.app/.netlify/functions/callback`を登録する必要があります

## 設定不要な環境変数

以下の環境変数は**Bot実行時のみ必要**で、Netlifyには設定不要です:

- `DISCORD_GUILD_ID` - Botのコマンド登録とロール付与に使用（Bot側の`.env`のみ）

## 設定手順

1. Netlifyにログイン
2. デプロイしたサイトを選択
3. **Site settings** をクリック
4. 左メニューから **Environment variables** を選択
5. **Add a variable** をクリック
6. 上記の6つの環境変数を追加

## 設定後の確認

環境変数を設定した後、以下の手順で確認してください:

1. **Deploys** → **Trigger deploy** → **Deploy site** で再デプロイ
2. デプロイが完了したら、Functions のログを確認
3. Discord Botを起動し、認証フローをテスト

## セキュリティ注意事項

- `DISCORD_BOT_TOKEN`と`DISCORD_CLIENT_SECRET`は機密情報です
- これらの値を絶対にGitHubにコミットしないでください
- `.env`ファイルは`.gitignore`に含まれていることを確認してください
- 環境変数が漏洩した場合は、すぐにDiscord Developer Portalでトークンを再生成してください

## トラブルシューティング

### 環境変数が反映されない

- 環境変数を追加/変更した後、サイトを再デプロイしてください
- Functionsのログで環境変数が正しく読み込まれているか確認

### URLが変わった場合

以下の環境変数を更新してください:
- `NETLIFY_URL`
- `REDIRECT_URI`
- Discord Developer PortalのOAuth2 Redirectsも更新

## 環境変数一覧表

| 変数名 | Netlify | Bot | 説明 |
|--------|---------|-----|------|
| `DISCORD_BOT_TOKEN` | ✅ 必須 | ✅ 必須 | Botトークン |
| `DISCORD_CLIENT_ID` | ✅ 必須 | ✅ 必須 | Application Client ID |
| `DISCORD_CLIENT_SECRET` | ✅ 必須 | ✅ 必須 | Application Client Secret |
| `DISCORD_GUILD_ID` | ❌ 不要 | ✅ 必須 | サーバーID（コマンド登録用） |
| `WEBHOOK_CHANNEL_ID` | ✅ 必須 | ✅ 必須 | 通知チャンネルID |
| `NETLIFY_URL` | ✅ 必須 | ❌ 不要 | デプロイURL |
| `REDIRECT_URI` | ✅ 必須 | ❌ 不要 | OAuth2コールバックURL |

## 参考

- [Netlify環境変数ドキュメント](https://docs.netlify.com/environment-variables/overview/)
- [Discord Developer Portal](https://discord.com/developers/applications)
