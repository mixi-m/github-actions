#!/usr/bin/env bash
# mix hex.audit の検出結果から、起票済みの脆弱性 (無視リスト) を除く。
#
# 入力 (環境変数):
#   AUDIT_DIR    mix hex.audit の出力 (audit.txt) と終了コード (code) があるディレクトリ
#   IGNORE_FILE  無視リストの yaml のパス。存在しない場合は何も無視しない
#
# 出力 (カレントディレクトリ):
#   filtered.txt  無視リストを適用した検出結果
#   ignored.md    無視した検出の一覧 (紐付けた Issue つき)
#   $GITHUB_OUTPUT に code=<終了コード>。無視したものだけが検出されていた場合は 0 になる
set -euo pipefail

audit_file="$AUDIT_DIR/audit.txt"
code=$(tr -d '[:space:]' < "$AUDIT_DIR/code")
if ! [[ "$code" =~ ^[0-9]+$ ]]; then
  echo "::error::mix hex.audit の終了コードが不正です: $code"
  exit 1
fi

# 無視リストの各エントリは、id と、起票済みの issues (1件以上) が必須
ids=""
if [ -f "$IGNORE_FILE" ]; then
  invalid=$(yq '(.ignores // [])[] | select(((.id // "") | test("^[A-Za-z0-9-]+$") | not) or ((.issues // []) | length == 0)) | (.id // "(id なし)")' "$IGNORE_FILE")
  if [ -n "$invalid" ]; then
    echo "::error::$IGNORE_FILE の各エントリには id と、起票済みの issues (1件以上) が必要です: $(echo "$invalid" | tr '\n' ' ')"
    exit 1
  fi
  ids=$(yq '(.ignores // [])[].id' "$IGNORE_FILE")
fi

# Hex の障害やネットワークエラーでも失敗するため、検出結果が含まれる場合のみ先に進む
if [ "$code" != "0" ] && ! grep -qE 'Advisories:|[Rr]etired' "$audit_file"; then
  echo "::error::mix hex.audit が検出結果なしで失敗しました。Issue は起票しません。"
  exit 1
fi

# "  <package> <version> - <advisory id> (<severity>)" から始まり、空行または字下げの無い行の手前までを1件の検出として、無視リストにある ID を除く
: > ignored_ids.txt
IDS="$ids" awk '
  BEGIN { n = split(ENVIRON["IDS"], a, /[[:space:]]+/); for (i = 1; i <= n; i++) if (a[i] != "") ign[a[i]] = 1 }
  function flush() { if (!skip) printf "%s", blk; blk = "" }
  /^  [^ ]+ [^ ]+ - [^ ]+ \(/ {
    flush(); inblk = 1; skip = ($4 in ign)
    if (skip) print $4, $1, $2 >> "ignored_ids.txt"
    blk = $0 "\n"; next
  }
  inblk && /^[^[:space:]]/ { flush(); inblk = 0 }
  inblk { blk = blk $0 "\n"; if ($0 ~ /^[[:space:]]*$/) { flush(); inblk = 0 }; next }
  { print }
  END { flush() }
' "$audit_file" > filtered.txt

kept=$(grep -cE '^  [^ ]+ [^ ]+ - [^ ]+ \(' filtered.txt || true)
if [ "$kept" = "0" ]; then
  grep -vxE 'Advisories:|Found packages with security advisories' filtered.txt > filtered.tmp || true
  mv filtered.tmp filtered.txt
fi

# 無視した検出を、紐付けた Issue とともに Issue 本文用に控える
: > ignored.md
while read -r id package version; do
  issues=$(ID="$id" yq '.ignores[] | select(.id == strenv(ID)) | .issues | join(", ")' "$IGNORE_FILE")
  echo "- $id ($package $version): $issues" >> ignored.md
done < ignored_ids.txt

unused=""
for id in $ids; do
  grep -q "^$id " ignored_ids.txt || unused="$unused $id"
done
if [ -n "$unused" ]; then
  echo "::notice::検出されなくなった ID が $IGNORE_FILE に残っています。不要なら削除してください:$unused"
fi
if [ -s ignored.md ]; then
  echo "起票済みの $(wc -l < ignored.md | tr -d ' ') 件を無視しました"
fi

# 無視したものだけが検出されていた場合は、検出なしとして扱う
if [ "$code" != "0" ] && [ "$kept" = "0" ] && ! grep -qE '[Rr]etired' "$audit_file"; then
  code=0
fi
echo "code=$code" >> "$GITHUB_OUTPUT"
