# hex-audit

Elixir プロジェクトの `mix.lock` を `mix hex.audit` で定期的に検査し、脆弱性またはリタイア済みパッケージが検出された場合に Issue を起票する Reusable Workflow です。

以下の動作をします。

1. 呼び出し元が渡した `mix hex.audit` の結果から、無視リストに登録された脆弱性を除きます。
1. 検出が残っている場合、`hex-audit` ラベルの Issue を **1本だけ** 起票します。既に open な Issue があれば新規作成せず、検出内容が変わったときだけ本文を更新してコメントします。
1. 検出が無くなると、open な Issue を自動で close します。
1. 検出結果が出力に無いまま失敗した場合 (Hex の障害など) は、起票せずワークフローを失敗させます。

## 使い方

`mix hex.audit` の実行と、依存の取得に必要な SSH 鍵の扱いは、**呼び出し元のジョブ** で行います。SSH 鍵はこのワークフローには渡されません。呼び出し元では、結果を artifact として渡すジョブと、このワークフローを呼ぶジョブの 2 つを定義します。

```yaml
name: hex audit

on:
  schedule:
    - cron: "0 0 * * *"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  audit:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@<sha> # <version>
      # 非公開の依存を取得する場合は、ここで SSH 鍵の設定を行う
      - uses: erlef/setup-beam@<sha> # <version>
        with:
          version-file: '.tool-versions'
          version-type: 'strict'
      - run: mix deps.get
      - name: mix hex.audit
        run: |
          # 検出時は終了コード 1 になるため、-e を外して結果を artifact に渡す
          set +e
          mkdir hex-audit-result
          mix hex.audit > hex-audit-result/audit.txt 2>&1
          echo $? > hex-audit-result/code
          cat hex-audit-result/audit.txt
      - uses: actions/upload-artifact@<sha> # <version>
        with:
          name: hex-audit-result
          path: hex-audit-result
          retention-days: 1

  report:
    needs: audit
    permissions:
      contents: read
      issues: write
    uses: mixi-m/github-actions/.github/workflows/hex-audit.yml@master
    with:
      artifact-name: hex-audit-result
```

## Inputs
| パラメータ | Required | Default | |
|-|-|-|-|
| `artifact-name` | ✓ | | `audit.txt` (`mix hex.audit` の出力) と `code` (終了コード) を含む artifact の名前。 |
| `ignore-file` | | `.github/hex-audit-ignore.yml` | 無視リストの yaml のパス (呼び出し元リポジトリ内)。存在しない場合は何も無視しません。 |
| `runs-on` | | `ubuntu-latest` | ジョブを実行するマシンの種類。 |

**注意**: GitHub Token (`GITHUB_TOKEN`) は自動的に利用可能なため、渡す必要はありません。

## 無視リスト

起票済みで対応方針が決まっている脆弱性は、呼び出し元リポジトリの `ignore-file` に **advisory ID 単位** で登録すると、検出結果から除かれます。パッケージ単位ではなく ID 単位のため、同じパッケージに新しい脆弱性が出た場合は通常どおり検知されます。

```yaml
ignores:
  - id: EEF-CVE-0000-00000
    issues:
      - https://github.com/example-org/example-repo/issues/1
    reason: 対応方針を検討中 (任意)
```

| キー | Required | |
|-|-|-|
| `id` | ✓ | `mix hex.audit` の出力に表示される advisory ID。 |
| `issues` | ✓ | 追跡している Issue。1件以上が必須で、空だとワークフローが失敗します。 |
| `reason` | | 無視している理由。 |

- 無視した検出は、Issue 本文の末尾に、紐付けた Issue とともに一覧表示されます。
- 無視したものだけが検出されていた場合は「検出なし」として扱い、open な Issue を自動で close します。
- 登録した ID が検出されなくなると、`::notice::` で一覧からの削除を促します。
- 解消したものは、一覧から削除してください。

## 前提条件

- 呼び出し元のジョブに `issues: write` の権限が必要です。
- ジョブのランナーに `yq` (mikefarah/yq) と `awk` が必要です。`ubuntu-latest` にはプリインストールされています。
- Issue の重複起票を防ぐため、`hex-audit` ラベルで Issue を探します。ラベルが無い場合は、初回の起票時に `hex-audit` と `vulnerability` を作成します。

## 実装

このワークフローは shell スクリプト ([`scripts/hex-audit`](https://github.com/mixi-m/github-actions/blob/master/scripts/hex-audit)) で実装されています。

- `filter.sh`: 無視リストを読み込み、検出結果から登録済みの脆弱性を除きます。
- `report.sh`: GitHub CLI (gh) で Issue を起票・更新・close します。
