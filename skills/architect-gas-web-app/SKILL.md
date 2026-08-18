---
name: architect-gas-web-app
description: AIエージェントがGAS (Google Apps Script) を用いたWebアプリケーションおよびスプレッドシート連携ツールの開発・アーキテクチャ設計を行う必要がある場合にトリガーすること。
---

## 実行プロセス
1. **フロントエンドとバックエンドの分離**:
   - `doGet(e)` は単なるエントリポイントとし、ビジネスロジックは別の関数に分離すること。
   - `HtmlService` を使用する際、フロントエンドのロジック（JavaScript）とスタイル（CSS）は別ファイル（`js.html`, `css.html`）に記述し、メインのHTMLファイルでインクルードする構造を採用すること。
2. **スプレッドシートへのアクセス最小化**:
   - スプレッドシートへの読み書き（`getRange()`, `getValues()`, `setValues()`）は非常に遅いため、可能な限りメモリ上でデータを一括処理し、シートへのアクセス回数を最小限に抑えること。
   - 複数行のデータを扱う場合は、1行ずつループで書き込むのではなく、2次元配列を用意して `setValues()` で一括で書き込むこと。
3. **API設計とJSON応答**:
   - フロントエンドからのリクエストに対しては `google.script.run` を利用するか、`doPost()` を用いてJSON形式で応答するエンドポイントとして設計すること。
   - 例: `return ContentService.createTextOutput(JSON.stringify(response)).setMimeType(ContentService.MimeType.JSON);`

## 成功基準
- GASの実行時間制限（6分）を意識した効率的なコード構造であり、UIのレスポンスが高速であること。

## 設計ルール

### 1. フロントエンド (UI) 設計ルール
フロントエンドの実装には、以下の制約とルールを適用します。
* **UIフレームワーク**:
  * 原則として最新の **Bootstrap** をCDN経由で読み込んで使用してください。
* **ダークモード対応**:
  * OSやブラウザのダークモード設定に連動する実装を標準としてください。
  * `window.matchMedia('(prefers-color-scheme: dark)').matches` を用いて判定し、`<body>` やナビゲーションバー（`nav`）の `data-bs-theme` 属性（Bootstrapの機能）を適切に切り替えるJavaScriptを記述してください。
* **HTMLのモジュール化**:
  * 巨大な1つのHTMLファイルではなく、コンポーネントごとにファイルを分割してください。（例: `Home.html`, `Header.html`, `Footer.html`）
  * バックエンドのGAS側で `HtmlService.createHtmlOutputFromFile('Header.html').getContent()` 等を用いて結合（include）するアプローチを採用してください。

### 2. バックエンド (GAS) 設計ルール
GAS側のコード（`.js` あるいは `.gs`）は、保守性と可読性を高めるため以下のルールに従います。
* **定数（Enum）の定義**:
  * 独自のEnumクラス・ユーティリティ（`Enum.js`など）は作成しないでください。
  * 代わりに、標準JavaScriptの `Object.freeze` を用いて、変更不可能なオブジェクトとしてEnumを定義してください。
    ```javascript
    // 例
    const AppStatus = Object.freeze({
      INITIALIZED: 'initialized',
      ERROR: 'error'
    });
    ```
* **スプレッドシートの初期化・セットアップ**:
  * スプレッドシートと連携するツールを作成する場合、必ず初期化処理（例: `onOpen()` や `init()` 関数）を実装し、以下の定型処理を含めてください。
    1. 処理対象シートの名前設定。
    2. ヘッダー行（1行目）の固定（`setFrozenRows(1)`）と、ヘッダー行への背景色の適用（例: `#add6ff` など視認性の良い色）。
    3. 行番号（`#`）などの連番カラムが必要な場合は、`ARRAYFORMULA` 等を用いて自動採番されるように設定する。
    4. ユーザーが操作しやすくなるよう、`SpreadsheetApp.getUi().createMenu()` を用いてカスタムメニューをUIに追加する。
  * 初期化済みかどうかの判定には `PropertiesService.getScriptProperties()` を利用し、二重で初期化処理が走らないように制御してください。

### 3. テキスト・HTML解析のルール
* 独自のパースライブラリ（文字列の `indexOf` 等を複雑に組み合わせたユーティリティ）は作成しないでください。
* HTMLの解析やテキスト抽出が必要な場合は、標準的な **正規表現（RegExp）**、またはGAS標準の `XmlService` などを活用してシンプルに実装してください。

### 4. 全体方針
* **車輪の再発明を避ける**: これまで手動でテンプレートとして用意していた処理（ベースのHTML構築や初期化スクリプト）は、都度このガイドラインに従って生成（スクラッチから構築）してください。これにより、常に最新の文法やフレームワークのバージョンアップに追従できます。
