#!/usr/bin/env zx

/**
 * PR 更新モジュール
 * PR の body を更新し、diff をコメントに投稿
 * GitHub CLI (gh) を使用
 */

/**
 * 2つのテキストの unified diff を生成
 * @param {string} oldText - 古いテキスト
 * @param {string} newText - 新しいテキスト
 * @returns {string} unified diff 形式の文字列
 */
function generateUnifiedDiff(oldText, newText) {
    const oldLines = oldText ? oldText.split("\n") : [];
    const newLines = newText.split("\n");

    const diffLines = [];
    diffLines.push("--- old");
    diffLines.push("+++ new");

    // 簡易的な diff 生成（完全な unified diff ではない）
    for (let i = 0; i < Math.max(oldLines.length, newLines.length); i++) {
        const oldLine = oldLines[i] || "";
        const newLine = newLines[i] || "";

        if (oldLine !== newLine) {
            if (oldLine) {
                diffLines.push(`-${oldLine}`);
            }
            if (newLine) {
                diffLines.push(`+${newLine}`);
            }
        }
    }

    return diffLines.join("\n");
}

/**
 * 新しく追加された行を取得
 * @param {string} oldText - 古いテキスト
 * @param {string} newText - 新しいテキスト
 * @returns {string | null} 新しく追加された最初の行（なければ null）
 */
function getFirstNewLine(oldText, newText) {
    const oldLines = new Set(oldText ? oldText.split("\n") : []);
    const newLines = newText.split("\n");

    for (const line of newLines) {
        if (!oldLines.has(line) && line.trim()) {
            return line;
        }
    }
    return null;
}

/**
 * PR の body を更新し、diff をコメントに投稿
 * @param {object} pr - PR オブジェクト
 * @param {string} newBody - 新しい body
 * @param {string} commentTemplate - コメントテンプレート
 * @returns {Promise<void>}
 */
export async function updatePrBody(pr, newBody, commentTemplate) {
    const oldBody = pr.body || "";

    console.log("\nUpdating PR body...");

    // PR の body を更新
    await $`gh pr edit ${pr.number} --body ${newBody}`;

    console.log("PR body updated successfully");

    // diff を生成
    const diff = generateUnifiedDiff(oldBody, newBody);
    const newLine = getFirstNewLine(oldBody, newBody) || "";

    // コメントを生成
    let comment = commentTemplate.replace("{diff}", diff);
    comment = comment.replace("{new_line}", newLine);

    // コメントを投稿
    console.log("Posting comment with diff...");
    await $`gh issue comment ${pr.number} --body ${comment}`;

    console.log("Comment posted successfully");
}
