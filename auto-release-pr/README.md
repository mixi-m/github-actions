# auto-release-pr

リリースPull Requestの本文を自動で書き換えるActionです。

以下の動作をします。

1. 対象となるリリースPRを探索、見つからなければ新たに作成します。
1. リリースPRに含まれる各コミットのコミットメッセージから含まれているPRの一覧を取得します。
1. リリースPRの本文を更新して、前後の差分をコメントに残します。

## Inputs
| パラメータ | Required | Default | |
|-|-|-|-|
| `githubToken` | ✔ | | GitHub Token。PRの探索や更新に利用されます。 |
| `baseBranch` | | `release` | リリースPRのBase Branch。PRの探索や作成時に利用されます。 |
| `headBranch` | | `master` | リリースPRのHead Branch。PRの探索や作成時に利用されます。 |
| `releasePRNumber` | | | リリースPRの番号。 `releasePRNumber` が指定されると `baseBranch`/`headBranch` は無視されます。 |
| `bodyTemplate` | | [`action.yml`](https://github.com/ratel-pay/github-actions/blob/master/auto-release-pr/action.yml) を参照 | PR本文の生成テンプレート。テンプレート内の `{summary}` が差分の箇条書きに置き換えられます。 |
| `commentTemplate` | | [`action.yml`](https://github.com/ratel-pay/github-actions/blob/master/auto-release-pr/action.yml) を参照 | 本文の更新差分のコメントのテンプレート。テンプレート内の `{diff}` が差分表示に置き換えられます。 |
| `releasePRLabel` | | | リリースPRにつけるラベル。新規作成時や既存のものに付与されていなかったときは新たに付与されます。 |

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
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: ratel-pay/github-actions/auto-release-pr@master
        with:
          githubToken: ${{ secrets.GITHUB_TOKEN }}
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
jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: ratel-pay/github-actions/auto-release-pr@master
        with:
          githubToken: ${{ secrets.GITHUB_TOKEN }}
          releasePRNumber: ${{ github.event.pull_request.number }}
```
