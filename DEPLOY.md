# Netlifyデプロイガイド

このドキュメントでは、このDiscord OAuth2 BotをNetlifyにデプロイする方法を説明します。

## 前提条件

- Netlifyアカウント
- GitHubアカウント
- Discord Developer Portalでアプリケーションを作成済み

## デプロイ手順

### 1. Netlifyにログイン

[Netlify](https://app.netlify.com/)にアクセスしてログインします。

### 2. 新しいサイトを作成

1. **Add new site** → **Import an existing project** をクリック
2. **GitHub** を選択
3. このリポジトリ (`mume-dayo/free`) を選択

### 3. ビルド設定

以下の設定が自動的に適用されます（`netlify.toml`から）:

- **Build command**: `npm install`
- **Publish directory**: `public`
- **Functions directory**: `netlify/functions`

**Deploy site** をクリック

### 4. 環境変数の設定

デプロイ後、以下の環境変数を設定します:

1. **Site settings** → **Environment variables** → **Add a variable**
2. 以下の変数を追加:

```
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_GUILD_ID=your_guild_id_here
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
WEBHOOK_CHANNEL_ID=your_webhook_channel_id_here
NETLIFY_URL=https://your-site-name.netlify.app
REDIRECT_URI=https://your-site-name.netlify.app/.netlify/functions/callback
```

**重要**: 環境変数を設定した後、サイトを再デプロイしてください。

### 5. Discord Developer Portalの設定更新

1. [Discord Developer Portal](https://discord.com/developers/applications)にアクセス
2. アプリケーションを選択
3. **OAuth2** → **Redirects** に以下を追加:
   ```
   https://your-site-name.netlify.app/.netlify/functions/callback
   ```

### 6. カスタムドメイン（オプション）

Netlifyのデフォルトドメイン（`*.netlify.app`）を使用できますが、カスタムドメインを設定することもできます:

1. **Domain settings** → **Add custom domain**
2. ドメインを追加し、DNS設定を行う
3. 環境変数の`NETLIFY_URL`と`REDIRECT_URI`を更新
4. Discord Developer Portalのリダイレクトも更新

## デプロイ後の確認

### 1. Functions が動作しているか確認

ブラウザで以下のURLにアクセス:
```
https://your-site-name.netlify.app/
```

トップページが表示されればOKです。

### 2. OAuth2フローのテスト

1. Discordサーバーで`/button role:@テストロール`を実行
2. 認証ボタンをクリック
3. OAuth2認証画面が表示されることを確認
4. 認証後、成功画面が表示されることを確認

## トラブルシューティング

### Functions がエラーになる

1. Netlify Functions のログを確認:
   - **Site overview** → **Functions** → 関数を選択 → **Function log**
2. 環境変数が正しく設定されているか確認
3. Node.jsバージョンを確認（`.nvmrc`で指定: 18）

### Redirects が動作しない

`netlify.toml`の設定を確認してください。以下のリダイレクトが設定されています:

```toml
[[redirects]]
  from = "/auth"
  to = "/.netlify/functions/auth"
  status = 200
```

### OAuth2認証が失敗する

1. Discord Developer Portalのリダイレクトが正しいか確認
2. 環境変数`DISCORD_CLIENT_ID`、`DISCORD_CLIENT_SECRET`が正しいか確認
3. `REDIRECT_URI`が正確に一致しているか確認

## デプロイの更新

GitHubにpushすると、Netlifyが自動的に再デプロイします:

```bash
git add .
git commit -m "Update configuration"
git push origin main
```

## Functions のローカルテスト

ローカルでFunctionsをテストする場合:

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:8888` にアクセスします。

## 本番環境のチェックリスト

- [ ] 全ての環境変数が設定されている
- [ ] Discord Developer Portalのリダイレクトが更新されている
- [ ] Discord Webhookが作成されている
- [ ] Botが対象サーバーに参加している
- [ ] Botに必要な権限が付与されている
- [ ] Bot IntentsがONになっている（SERVER MEMBERS, MESSAGE CONTENT）
- [ ] OAuth2フローが正常に動作する
- [ ] Webhook通知が届く
- [ ] ロール付与が正常に動作する

## サポート

問題が発生した場合は、リポジトリのIssueを作成してください。
