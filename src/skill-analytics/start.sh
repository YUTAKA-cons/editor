#!/bin/bash
# Skill Analytics Dashboard Startup Script

# 現在のディレクトリを取得
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================="
echo " Starting Skill Analytics Dashboard..."
echo "=========================================="

# 初回セットアップ確認
if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
fi

if [ ! -d "client/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd client && npm install && cd ..
fi

# バックグラウンドプロセスのPIDを保持する配列
PIDS=()

# 終了時のクリーンアップ処理
cleanup() {
    echo ""
    echo "Stopping servers..."
    for PID in "${PIDS[@]}"; do
        kill $PID 2>/dev/null
    done
    exit 0
}

# SIGINT (Ctrl+C) と SIGTERM をトラップ
trap cleanup SIGINT SIGTERM

# バックエンドサーバー起動
echo "Starting Backend API Server (port 3000)..."
npx nodemon server.js > backend.log 2>&1 &
PIDS+=($!)

# フロントエンド開発サーバー起動
echo "Starting Frontend UI Server..."
cd client
npm run dev -- --host > ../frontend.log 2>&1 &
PIDS+=($!)

echo "=========================================="
echo " Dashboard is running!"
echo " - Backend API: http://localhost:3000"
echo " - Frontend UI: http://localhost:5173"
echo " (Press Ctrl+C to stop)"
echo "=========================================="

# プロセスが終了するまで待機
wait
