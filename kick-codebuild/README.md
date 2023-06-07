# kick-codebuild

GitHub Actions から AWS CodeBuild の特定のジョブを起動するために必要となるワークフローです。
GitHub Actions の機能である、 [Reusing workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows) を用いて実現しています。

## 準備

利用にあたって、`codebuild-github-actions-role` というロールを準備する必要があります。
このロールには以下のドキュメントにしたがい、適切なポリシーをアタッチしてください。

- CodeBuild を起動、ならびにログを取得するためのポリシー
    - https://github.com/aws-actions/aws-codebuild-run-build#credentials-and-permissions
- GitHub ↔︎ AWS 間の認証
    - https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services

## Inputs

| パラメータ | Required | Default | |
|-|-|-|-|
| `aws_account_id` | ✔ | | 実行する AWS アカウントの ID |
| `codebuild_project_name` | ✔ | | CodeBuild のプロジェクト名 |
| `codebuild_buildspec` | | `buildspec.yml` | 実行する buildspec を上書きすることができます。 |
| `platform` | | `ubuntu-latest` | ジョブを実行するマシンの種類を上書きすることができます。 |

## Usage

詳細は[ドキュメント](https://docs.github.com/en/actions/using-workflows/reusing-workflows#calling-a-reusable-workflow)を参考にしてください。

以下は一例です。

```yaml
name: dryrun
on:
  push:
    branches-ignore:
      - master

permissions:
  id-token: write
  contents: read

jobs:
  example-job-1:
    uses: ratel-pay/github-actions/.github/workflows/kick-codebuild.yaml@master
    with:
      aws_account_id: 1234567890
      codebuild_project_name: example-job-1
  production:
    uses: ratel-pay/github-actions/.github/workflows/kick-codebuild.yaml@master
    with:
      aws_account_id: 1234567890
      codebuild_project_name: example-job-2
      codebuild_buildspec: buildspec/example.yaml
```
