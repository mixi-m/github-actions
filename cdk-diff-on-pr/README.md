# CDK Diff on PR

AWS CDK Stack の差分（diff）とドリフト（drift）を検知して、PR にコメントとして投稿する reusable workflow です。

## 機能

- CDK template と CloudFormation 上の既存 template の差分を計算
- Stack ごとのリソースの変更状況（追加・更新・削除）を表示
- CloudFormation Drift Detection による実環境との差異を検知
- 複数の AWS アカウント（staging, production など）に対応
- 過去のコメントを自動削除して常に最新の差分のみを表示

## 使用例

### パターン1: 複数 AWS アカウント

異なる AWS アカウントを使用する場合（例: staging と production で別のアカウント）。

```yaml
name: CDK Diff on PR
on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main]

jobs:
  cdk-diff:
    uses: mixi-m/github-actions/.github/workflows/cdk-diff-on-pr.yml@main
    with:
      aws_accounts: '[{"id": "123456789012", "name": "staging"}, {"id": "987654321098", "name": "production"}]'
      aws_role_name: GitHubActionsCdkRole
      aws_region: ap-northeast-1
    secrets: inherit
```

### パターン2: 単一 AWS アカウント + 環境別 CDK Context

同じ AWS アカウント内で複数環境を管理し、CDK context で環境を切り替える場合。

```yaml
name: CDK Diff on PR
on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main]

jobs:
  cdk-diff:
    uses: mixi-m/github-actions/.github/workflows/cdk-diff-on-pr.yml@main
    with:
      aws_accounts: '[{"id": "123456789012", "name": "dev"}, {"id": "123456789012", "name": "staging"}, {"id": "123456789012", "name": "prod"}]'
      aws_role_name: GitHubActionsCdkRole
      cdk_context: env
    secrets: inherit
```

このパターンでは、`cdk_context: env` を指定することで、各環境に対して `npm run -- cdk synth --context env=<環境名>` が実行されます。

## パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `aws_accounts` | ✅ | - | AWS アカウント ID と名前のマッピング（JSON 配列）。`name` フィールドは環境識別子として使用される |
| `aws_role_name` | ✅ | - | AssumeRole する IAM ロール名 |
| `aws_region` | ❌ | `ap-northeast-1` | AWS リージョン |
| `node_version_file` | ❌ | `.tool-versions` | Node.js バージョンファイルのパス |
| `working_directory` | ❌ | `.` | CDK プロジェクトのディレクトリ |
| `drift_detection_timeout_sec` | ❌ | `300` | ドリフト検知のタイムアウト（秒） |
| `cdk_context` | ❌ | `''` | CDK context パラメータのキー（例: `env`）。指定すると `--context <key>=<name>` が追加される |
| `comment_mode` | ❌ | `full` | PR コメントの詳細度。`full` / `summary`。詳細は下記「コメントの詳細度（comment_mode）」を参照 |

## 前提条件

- CDK プロジェクトが `npx cdk synth` で正常に実行できること
- GitHub Actions から AWS にアクセスできる IAM ロールが設定されていること（OIDC）
- `gh` CLI が使用できること（GitHub Actions のランナーにはデフォルトでインストール済み）
- プロジェクトに `@aws-cdk/cloudformation-diff` と `zx` がインストールされていること

## アーキテクチャ

このワークフローは以下のモジュールで構成されています：

- `config.mjs`: 環境変数から設定を読み込む
- `cdk-template.mjs`: CDK で template を生成
- `cfn-template.mjs`: CloudFormation から既存の template を取得
- `diff-calculator.mjs`: 差分を計算
- `drift-detector.mjs`: Stack drift を検知
- `comment-formatter.mjs`: PR コメントを生成
- `pr-comment.mjs`: GitHub PR にコメントを投稿
- `main.mjs`: メインエントリーポイント

## PR コメント例

各 Stack に対して以下の情報が表示されます：

- **差分の絵文字**
  - 🈚 変更なし
  - 🆕 新規追加
  - ✏️ 変更あり
  - ♻️ 変更あり（置換 : CFnによってリソースが一旦削除され再作成される）
  - 🗑 削除 (DeletionPolicy が Retain のもの、実際のリソースは削除されない)
  - 🔥 削除 (DeletionPolicy が Retain 以外、CFn によってリソースが削除される)

- **Drift の状態**
  - ⚠ NOT_CHECKED （未対応等でドリフト検知できない）
  - 🚨 MODIFIED （実際のリソースと CFn テンプレートに差異がある）
  - ✅ IN_SYNC（ドリフトがない）
  - 空欄（未作成のリソースなど）

## コメントの詳細度（comment_mode）

Stack 数が多いプロジェクトでは、`full`（既定）のコメントが数万文字に達し、GitHub のコメント上限（65536 文字）に近づく、あるいは超えて投稿自体が失敗することがあります。`comment_mode: summary` を指定すると、情報量を落とさずにコメントを大幅に短縮できます。

```yaml
with:
  aws_accounts: '...'
  aws_role_name: GitHubActionsCdkRole
  comment_mode: summary
```

### full（既定）

現行どおりの挙動です。全 Stack が個別のセクションを持ち、差分の有無に関わらず `cdk diff` の結果とリソース一覧（Drift 込み）を展開表示します。

### summary

- コメント冒頭に全 Stack 1 行ずつのサマリ表（状態 / 変更内訳 / Drift）を追加します
- 詳細セクションを展開するのは「差分があった Stack」または「Drift が `MODIFIED` の Stack」のみです。差分もドリフトも無い Stack はサマリ表の 1 行だけになります
- 展開したセクション内のリソース表も、実際に変更のあった行と Drift `MODIFIED` の行だけに絞ります。省略した行数は注記されます
- 省略した内容（全 Stack・全リソースの差分と Drift）は、コメントからではなく本 Matrix Job の Actions ログ（`Stack <name> diff` / `Stack <name> resources` グループ）に必ず出力されます。コメントには当該ログへのリンクを含みます
- コメントが 65536 文字の上限に達した場合は投稿を失敗させず、安全な位置で切り詰めて投稿します（この場合もログには完全な内容が残ります）

`full` の出力仕様は変更していないため、`comment_mode` を指定しない既存の利用者への影響はありません。

## トラブルシューティング

### Drift Detection がタイムアウトする

`drift_detection_timeout_sec` を増やしてください：

```yaml
with:
  drift_detection_timeout_sec: 600  # 10分
```

### コメントが投稿されない

- `pull-requests: write` 権限が付与されているか確認してください
- `GITHUB_TOKEN` が正しく渡されているか確認してください

### CDK Synth が失敗する

- `working_directory` が正しく設定されているか確認してください
- 依存関係が正しくインストールされているか確認してください
