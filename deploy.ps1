# Cloud Run デプロイスクリプト (PowerShell 版)
# 使い方：.\deploy.ps1 -ProjectId "my-project-12345"

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectId
)

$Region = "asia-northeast1"
$ServiceName = "line-building-law-bot"

Write-Host "🚀 Cloud Run にデプロイ開始..." -ForegroundColor Green
Write-Host "プロジェクト ID: $ProjectId"
Write-Host "リージョン：$Region"
Write-Host "サービス名：$ServiceName"
Write-Host ""

# GCP プロジェクト設定
Write-Host "📋 GCP プロジェクトを設定..." -ForegroundColor Yellow
gcloud config set project $ProjectId

# シークレット作成（まだ存在しない場合）
Write-Host "📦 シークレットを確認..." -ForegroundColor Yellow
$null = gcloud secrets create LINE_CHANNEL_SECRET --data-file=/dev/null --project $ProjectId --replication-policy=automatic 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "LINE_CHANNEL_SECRET は既に存在します" -ForegroundColor Gray
}

$null = gcloud secrets create LINE_CHANNEL_ACCESS_TOKEN --data-file=/dev/null --project $ProjectId --replication-policy=automatic 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "LINE_CHANNEL_ACCESS_TOKEN は既に存在します" -ForegroundColor Gray
}

Write-Host ""
Write-Host "⚠️  シークレットの値を設定してください：" -ForegroundColor Yellow
Write-Host "1. LINE Developers コンソールでチャネルシークレットとアクセストークンをコピー"
Write-Host "2. 以下のコマンドでシークレットを更新："
Write-Host ""
Write-Host "   echo 'your_channel_secret' | gcloud secrets versions add LINE_CHANNEL_SECRET --data-file=-"
Write-Host "   echo 'your_access_token' | gcloud secrets versions add LINE_CHANNEL_ACCESS_TOKEN --data-file=-"
Write-Host ""
Read-Host "シークレットの設定が完了したら Enter を押してください"

# Cloud Build でデプロイ
Write-Host "🔨 Cloud Build でデプロイ開始..." -ForegroundColor Yellow
gcloud builds submit --config cloudbuild.yaml --project $ProjectId

Write-Host ""
Write-Host "✅ デプロイ完了！" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Webhook URL を LINE Developers コンソールに設定：" -ForegroundColor Cyan
Write-Host "   https://$ServiceName-*.a.run.app/callback"
Write-Host ""
Write-Host "サービス URL を確認：" -ForegroundColor Cyan
Write-Host "   gcloud run services describe $ServiceName --region $Region --project $ProjectId --format 'value(status.url)'"
