# Discord OAuth2 Bot with Auto Join & Role Assignment

Discord OAuth2認証を使用して、ユーザーを自動的にサーバーに参加させ、指定したロールを付与し、別のサーバーにも参加させるBotシステムです。

## 機能

- **OAuth2認証**: Discordアカウントを使用した安全な認証
- **自動サーバー参加**: `guilds.join`スコープを使用してユーザーを自動的にサーバーに追加
- **自動ロール付与**: 認証完了後、指定されたロールを自動付与
- **認証パネル**: `/button`コマンドで認証ボタン付きパネルを生成
- **別サーバー参加**: `/call`コマンドで認証済みユーザーを別のサーバーに一括参加
- **Netlify統合**: サーバーレス関数を使用したOAuth2フロー
- **Bot Token連携**: Netlifyが Bot Tokenでチャンネルにメッセージ送信、Botが監視

## システム構成

```
┌─────────────┐      ┌──────────────┐
│   Discord   │ ←──→ │   Netlify    │
│    User     │      │  Functions   │
└─────────────┘      └──────┬───────┘
                             │ (Bot Token使用)
                             ↓
                      ┌─────────────┐
                      │  Discord    │
                      │  Channel    │
                      └──────┬──────┘
                             │
                             ↓
                      ┌─────────────┐
                      │  Discord    │
                      │     Bot     │
                      │   (監視)    │
                      └─────────────┘
```

## セットアップ

### 1. Discord Developer Portalの設定

1. [Discord Developer Portal](https://discord.com/developers/applications)にアクセス
2. 新しいアプリケーションを作成
3. **Bot**セクションで以下を設定:
   - `SERVER MEMBERS INTENT`を有効化
   - `MESSAGE CONTENT INTENT`を有効化
   - Bot Tokenをコピー
4. **OAuth2**セクションで以下を設定:
   - Redirect URIを追加: `https://your-app.netlify.app/.netlify/functions/callback`
   - Client IDとClient Secretをコピー
5. **Bot Permission**で以下を選択:
   - `Manage Roles`
   - `Create Instant Invite`
   - `View Channels`
   - `Send Messages`
   - `Read Messages`
6. Bot招待URLを生成してサーバーに追加:
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=268435456&scope=bot%20applications.commands
   ```

### 2. 通知チャンネルの作成

1. Discordサーバーで認証通知を受け取るチャンネルを作成（例: `#auth-notifications`）
2. チャンネルIDをコピー（チャンネルを右クリック → IDをコピー）
3. このチャンネルにはBotのみがアクセスできるように権限を設定することを推奨

### 3. 環境変数の設定

`.env`ファイルを作成し、以下の環境変数を設定:

```env
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
DISCORD_GUILD_ID=your_guild_id_here

# Notification Channel Configuration
WEBHOOK_CHANNEL_ID=your_notification_channel_id_here

# Netlify Configuration
NETLIFY_URL=https://your-app.netlify.app
REDIRECT_URI=https://your-app.netlify.app/.netlify/functions/callback
```

### 4. Netlifyの設定

1. [Netlify](https://www.netlify.com/)にログイン
2. 新しいサイトを作成
3. リポジトリを接続
4. 環境変数を設定:
   - `Settings` → `Environment variables`で上記の環境変数を設定
5. デプロイ

### 5. Botの起動

```bash
# 依存関係のインストール
npm install

# Botの起動
npm run bot
```

## 使用方法

### 管理者向け

#### 認証パネルの作成

```
/button role:@ロール名
```

このコマンドを実行すると、OAuth認証用のボタン付きパネルが作成されます。

#### 認証済みユーザーを別サーバーに参加させる

```
/call server_id:123456789012345678
```

認証済みのユーザー全員を指定したサーバーIDのサーバーに一括参加させます。

**注意**:
- Botが対象サーバーに参加している必要があります
- Botが対象サーバーで`Create Instant Invite`権限を持っている必要があります

### ユーザー向け

1. 管理者が作成した認証パネルの「認証する」ボタンをクリック
2. Discord OAuth2認証画面でアクセスを許可
3. 自動的にサーバーに参加し、ロールが付与されます
4. 成功画面が表示されます

## プロジェクト構造

```
.
├── bot/
│   └── index.js              # Discord Bot本体
├── netlify/
│   └── functions/
│       ├── auth.js           # OAuth2認証開始
│       └── callback.js       # OAuth2コールバック処理
├── public/
│   ├── index.html            # トップページ
│   └── success.html          # 認証成功ページ
├── .env.example              # 環境変数のサンプル
├── .gitignore
├── netlify.toml              # Netlify設定
├── package.json
└── README.md
```

## フロー詳細

### 認証フロー

1. **認証開始**:
   - ユーザーが認証ボタンをクリック
   - Netlify Function (`/auth`)にリダイレクト
   - Discord OAuth2認証画面に遷移

2. **認証処理**:
   - ユーザーがアクセスを許可
   - Discord APIが認証コードを発行
   - Netlify Function (`/callback`)が認証コードを受信

3. **トークン交換**:
   - 認証コードをアクセストークンに交換
   - ユーザー情報を取得

4. **サーバー参加**:
   - `guilds.join`スコープを使用してユーザーをサーバーに追加
   - Bot TokenとアクセストークンでPUT `/guilds/{guild.id}/members/{user.id}`

5. **通知送信**:
   - Netlify FunctionがBot Tokenを使用して通知チャンネルにメッセージを送信
   - メッセージ内容: ユーザーID、セッションID、アクセストークンをJSON形式
   - Botが自分のメッセージを検知

6. **ロール付与**:
   - Botがユーザーにロールを付与
   - アクセストークンを保存（別サーバー参加用）
   - パネルメッセージを更新
   - 通知メッセージを削除

### 別サーバー参加フロー

1. 管理者が`/call server_id:TARGET_SERVER_ID`を実行
2. Botが認証済みユーザー一覧を取得
3. 保存されたアクセストークンを使用して各ユーザーを対象サーバーに追加
4. 結果をEmbedで表示（成功/失敗数、詳細）

## トラブルシューティング

### Botがサーバーにユーザーを追加できない

- Botが`SERVER MEMBERS INTENT`を有効にしているか確認
- Botが`Manage Roles`権限を持っているか確認
- Botのロールがターゲットロールより上位にあるか確認

### OAuth2認証が失敗する

- Redirect URIがDiscord Developer Portalに正しく設定されているか確認
- Client IDとClient Secretが正しいか確認
- 環境変数が正しく設定されているか確認

### 通知が届かない

- `WEBHOOK_CHANNEL_ID`が正しく設定されているか確認
- Botが`MESSAGE CONTENT INTENT`を有効にしているか確認
- Botが通知チャンネルにメッセージを送信できる権限を持っているか確認
- NetlifyのEnvironment Variablesに`DISCORD_BOT_TOKEN`と`WEBHOOK_CHANNEL_ID`が設定されているか確認

### `/call`でユーザーを追加できない

- Botが対象サーバーに参加しているか確認
- アクセストークンが期限切れでないか確認（OAuth2トークンは通常7日間有効）
- ユーザーが既に対象サーバーに参加していないか確認

## 本番環境での推奨事項

- **セッションストレージ**: メモリベースではなくRedisなどを使用
- **アクセストークンの暗号化**: トークンを保存する際は暗号化を推奨
- **エラーハンドリング**: より詳細なログとエラー処理を追加
- **レート制限**: Discord APIのレート制限を考慮（特に一括参加時）
- **セキュリティ**: Webhook認証トークンの検証を追加
- **トークンの有効期限管理**: 期限切れトークンを自動削除

## セキュリティ注意事項

- アクセストークンは機密情報です。ログに出力しないでください
- 通知チャンネルはBotのみがアクセスできるように権限を設定してください
- 通知メッセージは自動削除されますが、念のため閲覧権限を制限することを推奨
- 本番環境では環境変数を`.env`ファイルではなく、安全な方法で管理してください
- `DISCORD_BOT_TOKEN`は絶対にGitHubにコミットしないでください

## ライセンス

MIT

## サポート

問題が発生した場合は、Issueを作成してください。
