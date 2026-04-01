# LINE Building Law Bot

建築基準法 MCP サーバーを LINE Bot から利用するためのアプリケーション。

## 機能

- 📖 **条文取得**: 法令名と条番号を指定して条文を取得
- 🔍 **法令検索**: キーワードで法令を検索
- 📋 **全文取得**: 法令全体のテキストを取得
- 📢 **告示取得**: 建築基準法が委任する告示を取得

## 対応法令

- 建築基準法（建基法）
- 建築基準法施行令（建基令）
- 建築基準法施行規則（建基規則）
- 都市計画法（都計法）
- 消防法
- その他 112 法令

## セットアップ

### 1. 事前準備

- [Building Standards Act MCP](https://github.com/Sora-bluesky/building-standards-act-mcp) をインストール済みであること
- LINE Developers コンソールで Bot チャネルを作成済みであること

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` ファイルを編集：

```env
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
PORT=8080
```

### 3. 依存関係のインストール

```bash
bun install
```

### 4. 開発サーバーの起動

```bash
bun run dev
```

### 5. 本番サーバーの起動

```bash
bun run start
```

## LINE Developers 設定

### Webhook URL

```
https://your-server.com/callback
```

### Webhook の利用

- [x] 利用する

## 使い方

### LINE Bot での質問例

```
建築基準法第 20 条
```

```
建基法 6 条
```

```
耐火構造について教えて
```

```
建築基準法施行令の全文
```

```
耐火構造の構造方法を定める件
```

### コマンド

- `ヘルプ` - 使い方を表示
- `テスト` - 接続テスト

## 技術スタック

- **ランタイム**: Bun
- **フレームワーク**: Hono
- **LINE SDK**: @line/bot-sdk
- **MCP**: building-standards-act-mcp

## デプロイ

### Cloud Run (GCP) - GitHub から

#### 事前準備

1. GCP プロジェクトを作成・有効化
```bash
gcloud projects create YOUR-PROJECT-ID
gcloud config set project YOUR-PROJECT-ID
```

2. 必要な API を有効化
```bash
gcloud services enable cloudbuild.googleapis.com run.googleapis.com containerregistry.googleapis.com secretmanager.googleapis.com
```

3. シークレットを作成
```bash
echo -n 'your_line_channel_secret' | gcloud secrets create LINE_CHANNEL_SECRET --data-file=-
echo -n 'your_line_channel_access_token' | gcloud secrets create LINE_CHANNEL_ACCESS_TOKEN --data-file=-
```

#### デプロイ方法

**方法 1: デプロイスクリプトを使用（推奨）**
```bash
# PowerShell
.\deploy.ps1 -ProjectId "YOUR-PROJECT-ID"

# Bash
./deploy.sh YOUR-PROJECT-ID
```

**方法 2: 手動デプロイ**
```bash
gcloud builds submit --config cloudbuild.yaml --project YOUR-PROJECT-ID
```

#### Webhook 設定

デプロイ後、表示された URL を LINE Developers コンソールに設定：
```
https://line-building-law-bot-xxx.a.run.app/callback
```

### ローカルから直接デプロイ

```bash
gcloud run deploy line-building-law-bot \
  --source . \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-secrets LINE_CHANNEL_SECRET=LINE_CHANNEL_SECRET:latest,LINE_CHANNEL_ACCESS_TOKEN=LINE_CHANNEL_ACCESS_TOKEN:latest
```

### Vercel

`vercel.json` を作成：

```json
{
  "builds": [
    {
      "src": "src/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/index.ts"
    }
  ]
}
```

## 開発

```bash
# 開発モード（ホットリロード）
bun run dev

# 型チェック
bun tsc --noEmit
```

## ライセンス

MIT
