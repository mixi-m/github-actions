# auto-release-pr

リリースPull Requestの本文を自動で書き換える Reusable Workflow です。

以下の動作をします。

1. 対象となるリリースPRを探索、見つからなければ新たに作成します。
1. リリースPRに含まれる各コミットのコミットメッセージから含まれているPRの一覧を取得します。
1. リリースPRの本文を更新して、前後の差分をコメントに残します。

## 実装

このワークフローは Node.js + mjs で実装されており、Docker を使用しません。

### 技術スタック
- **Node.js LTS** - 実行環境
- **zx** - シェルスクリプト実行
- **GitHub CLI (gh)** - GitHub API 操作

### 特徴
- GitHub CLI (gh) を使用するため、`@octokit/rest` などの npm パッケージのインストールが不要
- GitHub Actions の `GITHUB_TOKEN` を gh コマンドが自動的に使用
- ubuntu-latest にプリインストールされている gh コマンドを活用し、高速に動作

## Inputs
| パラメータ | Required | Default | |
|-|-|-|-|
| `baseBranch` | | `release` | リリースPRのBase Branch。PRの探索や作成時に利用されます。 |
| `headBranch` | | `master` | リリースPRのHead Branch。PRの探索や作成時に利用されます。 |
| `releasePRNumber` | | | リリースPRの番号。 `releasePRNumber` が指定されると `baseBranch`/`headBranch` は無視されます。 |
| `bodyTemplate` | | `## Changes\n\n{summary}` | PR本文の生成テンプレート。テンプレート内の `{summary}` が差分の箇条書きに置き換えられます。 |
| `commentTemplate` | | [デフォルトテンプレート](https://github.com/mixi-m/github-actions/blob/master/.github/workflows/auto-release-pr.yml#L35-L46) | 本文の更新差分のコメントのテンプレート。テンプレート内の `{diff}` が差分表示に、`{new_line}`が新規差分の先頭一行目に置き換えられます。 |
| `releasePRLabel` | | | リリースPRにつけるラベル。新規作成時や既存のものに付与されていなかったときは新たに付与されます。 |
| `newReleasePRTitle` | | `[リリース]` | 新規作成するリリースPRのタイトル |

**注意**: GitHub Token (`GITHUB_TOKEN`) は自動的に利用可能なため、inputs として渡す必要はありません。

## 前提条件

このワークフローを使用する前に、以下の設定が必要です：

1. **GitHub Actions の権限設定**
   - リポジトリの Settings > Actions > General > Workflow permissions
   - "Allow GitHub Actions to create and approve pull requests" を **ON** にする

2. **ラベルの作成**（`releasePRLabel` を使用する場合）
   - 指定するラベルを事前にリポジトリに作成しておく必要があります
   - ラベルが存在しない場合、ワークフローはエラーになります

## Usage

ブランチ運用フローによって2つの使い方があります。

### `master` ブランチを直接 `release` ブランチに取り込む場合

`master` 向きのPRがマージされるたびに、 `master` から `release` ブランチに向いているPRを探索 or 作成し、その本文を置き換えます。

```yaml
on:
  pull_request:
    types:
      - closed
    branches:
      - master

permissions:
  contents: read
  pull-requests: write

jobs:
  update:
    uses: mixi-m/github-actions/.github/workflows/auto-release-pr.yml@master
    # with:
      # Set if needed
      # baseBranch: release
      # headBranch: master
```

### リリースのたびにブランチを切ってPull Requestを作成している場合

`release` に向けたPRのBranchが更新されるたびに、その本文を置き換えます。

```yaml
on:
  pull_request:
    types:
      - opened
      - synchronized
    branches:
      - release

permissions:
  contents: read
  pull-requests: write

jobs:
  update:
    uses: mixi-m/github-actions/.github/workflows/auto-release-pr.yml@master
    with:
      releasePRNumber: ${{ github.event.pull_request.number }}
```
