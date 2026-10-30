#!/usr/bin/env bash
# filter.sh の結果をもとに、hex-audit ラベルの Issue を起票・更新・close する。
#
# 入力 (環境変数):
#   AUDIT_CODE   filter.sh が出力した code
#   IGNORE_FILE  無視リストの yaml のパス (Issue 本文に載せる)
#   GH_TOKEN, GH_REPO  gh コマンド用
# 入力 (カレントディレクトリ): filter.sh が出力した filtered.txt, ignored.md
set -euo pipefail

run_url="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
# hex-audit ラベルの open な Issue を追跡用の1本として扱う。
# 検索 API は反映が遅れて重複起票の原因になるため、ラベル指定の一覧を使う。
number=$(gh issue list --label hex-audit --state open --json number --jq '.[0].number // empty')

if [ "$AUDIT_CODE" = "0" ]; then
  echo "脆弱性は検出されませんでした"
  if [ -n "$number" ]; then
    gh issue comment "$number" --body "mix hex.audit で、無視リストに無い脆弱性が検出されなくなったため close します。 ($run_url)"
    gh issue close "$number"
  fi
  exit 0
fi

# 検出内容の指紋。前回と同じ内容なら更新・通知しない (無視している一覧の変更も本文に反映するため含める)
fingerprint=$({ cat filtered.txt ignored.md | grep -v '^[[:space:]]*$' || true; } | sort | sha256sum | cut -d' ' -f1)

{
  echo "mix hex.audit で、mix.lock に含まれるパッケージの脆弱性またはリタイアが検出されました。"
  echo
  echo "- 検出した実行: $run_url"
  echo "- 解消すると、次回の定期実行で自動的に close されます。"
  echo
  echo '```'
  cat filtered.txt
  echo '```'
  if [ -s ignored.md ]; then
    echo
    echo "起票済みのため無視している検出 ($IGNORE_FILE):"
    echo
    cat ignored.md
  fi
  echo
  echo "<!-- hex-audit-fingerprint: $fingerprint -->"
} > body.md

if [ -z "$number" ]; then
  # ラベルが無い場合は gh issue create が失敗するため、先に作成しておく (既存なら何もしない)
  gh label create hex-audit --description "mix hex.audit で検出された依存の脆弱性" 2>/dev/null || true
  gh label create vulnerability 2>/dev/null || true
  gh issue create \
    --title "Hex 依存パッケージの脆弱性が検出されています (mix hex.audit)" \
    --label hex-audit \
    --label vulnerability \
    --body-file body.md
  exit 0
fi

current=$(gh issue view "$number" --json body --jq .body | grep -oE 'hex-audit-fingerprint: [0-9a-f]+' | cut -d' ' -f2 || true)
if [ "$current" = "$fingerprint" ]; then
  echo "前回から検出内容に変更がないため、Issue #$number は更新しません"
  exit 0
fi

gh issue edit "$number" --body-file body.md
gh issue comment "$number" --body "検出内容が変わりました。本文を更新しています。 ($run_url)"
