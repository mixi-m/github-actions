# claude-code

Claude PR ActionはGitHubのPull Request、Issue、コメントに対して `@claude` メンションで Claude AI によるコードレビューや課題解決を自動化するActionです。

Claude Codeを使用してPRレビューやIssue対応を自動化し、開発効率を向上させます。

## 機能

- **PRレビュー**: `@claude` メンションでPull Requestの自動レビュー
- **Issue解決**: Issue上で `@claude` メンションによる自動的な修正対応とPR作成
- **コメント対応**: PR/Issueのコメントに対するインタラクティブな対話

## 設定

このActionは以下のイベントに対応します：

- `issue_comment`: Issue・PRコメントへの `@claude` メンション
- `pull_request_review_comment`: PRレビューコメントへの `@claude` メンション  
- `pull_request_review`: PRレビューでの `@claude` メンション
- `issues`: Issue作成・アサイン時の `@claude` メンション

## 必要な権限

```yaml
permissions:
  contents: write
  pull-requests: write
  issues: write
  id-token: write
```

## Inputs
| パラメータ | Required | Default | |
|-|-|-|-|
| `runs-on` | | `ubuntu-latest` | ジョブを実行するマシンの種類 |
| `model` | | `apac.anthropic.claude-sonnet-4-20250514-v1:0` | 使用するClaudeモデル |
| `region` | | `ap-northeast-1` | 使用するAWSリージョン |

## Secrets
| パラメータ | Required | |
|-|-|-|
| `AWS_ROLE_TO_ASSUME` | ✔ | BedrockへのアクセスのためのAWS OIDCロール |

## AWS設定

Claude Code ActionをBedrockで使用するため、以下の設定が必要です：

1. AWS OIDCロールの設定
2. `AWS_ROLE_TO_ASSUME` シークレットの設定
3. Bedrockでの Claude Sonnet 4 モデルのアクセス許可

## Usage

詳細は[ドキュメント](https://docs.github.com/en/actions/using-workflows/reusing-workflows#calling-a-reusable-workflow)を参考にしてください。

以下は一例です。

```yaml
name: Claude PR Action

permissions:
  contents: write
  pull-requests: write
  issues: write
  id-token: write

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned]
  pull_request_review:
    types: [submitted]

jobs:
  claude-pr:
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review' && contains(github.event.review.body, '@claude')) ||
      (github.event_name == 'issues' && contains(github.event.issue.body, '@claude'))
    uses: mixi-m/github-actions/.github/workflows/claude-code.yml@master
    with:
      runs-on: 'ubuntu-latest'  # オプション、デフォルト: ubuntu-latest
      model: 'apac.anthropic.claude-sonnet-4-20250514-v1:0'  # オプション
      region: 'ap-northeast-1'  # オプション、デフォルト: ap-northeast-1
    secrets:
      AWS_ROLE_TO_ASSUME: ${{ secrets.AWS_ROLE_TO_ASSUME }}
```

## 使い方

### PRレビュー
Pull Requestに `@claude` メンションでコメントすると、Claudeが自動的に：
1. 保留中のレビューを開始
2. 変更内容を確認
3. 問題があればインラインコメントを追加
4. non-blockingなレビューとして提出

### Issue解決
Issueに `@claude` メンションすると、Claudeが：
1. Issue内容を解析
2. 修正対応を実施
3. 新しいブランチを作成してPRを提出
4. Issue番号を明記した適切な説明を付与