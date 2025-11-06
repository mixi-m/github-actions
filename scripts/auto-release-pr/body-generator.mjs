#!/usr/bin/env zx

/**
 * PR Body 生成モジュール
 * マージされた PR のリストから body を生成
 */

/**
 * マージされた PR のリストから箇条書きを生成
 * @param {Array<{number: number, title: string}>} mergedPrs - マージされた PR の配列
 * @returns {string} 箇条書き形式の文字列
 */
function generatePrList(mergedPrs) {
    return mergedPrs.map((pr) => `- #${pr.number}: ${pr.title}`).join("\n");
}

/**
 * テンプレートを使って PR body を生成
 * @param {Array<{number: number, title: string}>} mergedPrs - マージされた PR の配列
 * @param {string} template - Body テンプレート
 * @returns {string | null} 生成された body（PR がない場合は null）
 */
export function generatePrBody(mergedPrs, template) {
    if (!mergedPrs || mergedPrs.length === 0) {
        console.log("No merged PRs found");
        return null;
    }

    const summary = generatePrList(mergedPrs);
    const body = template.replace("{summary}", summary);

    return body;
}
