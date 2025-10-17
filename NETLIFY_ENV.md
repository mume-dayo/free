# Netlify環境変数設定

Netlifyにデプロイする際に設定が必要な環境変数の一覧です。

## 必須環境変数

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

```
DISCORD_GUILD_ID=your_guild_id_here
```
- 認証後にユーザーを参加させるDiscordサーバーのID
- サーバー設定 → ウィジェット → サーバーID からコピー
- または開発者モードでサーバーを右クリック → IDをコピー

### 2. Notification Channel Configuration

```
WEBHOOK_CHANNEL_ID=your_notification_channel_id_here
```
- 認証通知を受け取るDiscordチャンネルのID
- チャンネルを右クリック → IDをコピー
- このチャンネルにNetlifyがBotとしてメッセージを送信します

### 3. Netlify Configuration

```
NETLIFY_URL=https://your-site-name.netlify.app
```
- NetlifyでデプロイされたサイトのURL
- 初回デプロイ後に自動で割り当てられる
- Site settings → Site details → Site information → Site URL からコピー

```
REDIRECT_URI=https://your-site-name.netlify.app/.netlify/functions/callback
```
- OAuth2のコールバックURL
- `NETLIFY_URL`に`/.netlify/functions/callback`を追加したもの
- Discord Developer Portal → OAuth2 → Redirects にも同じURLを登録する必要があります

## 設定手順

1. Netlifyにログイン
2. デプロイしたサイトを選択
3. **Site settings** をクリック
4. 左メニューから **Environment variables** を選択
5. **Add a variable** をクリック
6. 上記の各環境変数を追加

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

## 参考

- [Netlify環境変数ドキュメント](https://docs.netlify.com/environment-variables/overview/)
- [Discord Developer Portal](https://discord.com/developers/applications)
