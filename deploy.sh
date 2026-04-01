#!/bin/bash
# Cloud Run デプロイスクリプト

set -e

# 設定
PROJECT_ID="${1:-}"
REGION="asia-northeast1"
SERVICE_NAME="line-building-law-bot"

if [ -z "$PROJECT_ID" ]; then
    echo "使用方法：./deploy.sh <PROJECT_ID>"
    echo "例：./deploy.sh my-project-12345"
    exit 1
fi

echo "🚀 Cloud Run にデプロイ開始..."
echo "プロジェクト ID: $PROJECT_ID"
echo "リージョン：$REGION"
echo "サービス名：$SERVICE_NAME"

# GCP プロジェクト設定
gcloud config set project $PROJECT_ID

# シークレット作成（まだ存在しない場合）
echo "📦 シークレットを確認..."
echo -n "LINE_CHANNEL_SECRET" | gcloud secrets create LINE_CHANNEL_SECRET --data-file=- --project $PROJECT_ID --replication-policy=automatic 2>/dev/null || echo "LINE_CHANNEL_SECRET は既に存在します"
echo -n "LINE_CHANNEL_ACCESS_TOKEN" | gcloud secrets create LINE_CHANNEL_ACCESS_TOKEN --data-file=- --project $PROJECT_ID --replication-policy=automatic 2>/dev/null || echo "LINE_CHANNEL_ACCESS_TOKEN は既に存在します"

echo ""
echo "⚠️  シークレットの値を設定してください："
echo "1. LINE Developers コンソールでチャネルシークレットとアクセストークンをコピー"
echo "2. 以下のコマンドでシークレットを更新："
echo ""
echo "   echo -n 'your_channel_secret' | gcloud secrets versions add LINE_CHANNEL_SECRET --data-file=-"
echo "   echo -n 'your_access_token' | gcloud secrets versions add LINE_CHANNEL_ACCESS_TOKEN --data-file=-"
echo ""
read -p "シークレットの設定が完了したら Enter を押してください..."

# Cloud Build でデプロイ
echo "🔨 Cloud Build でデプロイ開始..."
gcloud builds submit --config cloudbuild.yaml --project $PROJECT_ID

echo ""
echo "✅ デプロイ完了！"
echo ""
echo "📱 Webhook URL を LINE Developers コンソールに設定："
echo "   https://$SERVICE_NAME-*.a.run.app/callback"
echo ""
echo "サービス URL を確認："
echo "   gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format 'value(status.url)'"
