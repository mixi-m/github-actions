#!/usr/bin/env zx

/**
 * Release PR 検索・作成モジュール
 * GitHub CLI (gh) を使用
 */

/**
 * 最新の release PR を検索
 * @param {string} base - Base Branch
 * @param {string} head - Head Branch
 * @returns {Promise<object | null>} PR オブジェクトまたは null
 */
async function findLatestReleasePr(base, head) {
    try {
        const result = await $`gh pr list --state open --base ${base} --head ${head} --json number,title,body --limit 1`;
        const prs = JSON.parse(result.stdout);

        if (prs.length > 0) {
            return prs[0];
        }
        return null;
    } catch (error) {
        // PR が見つからない場合
        return null;
    }
}

/**
 * Release PR を検索、なければ作成
 * @param {string} base - Base Branch
 * @param {string} head - Head Branch
 * @param {string | null} prNumber - PR 番号（指定されている場合）
 * @param {string} newTitle - 新規 PR のタイトル
 * @returns {Promise<object>} PR オブジェクト
 */
export async function findOrCreateReleasePr(base, head, prNumber, newTitle) {
    // PR 番号が指定されている場合は、その PR を取得
    if (prNumber) {
        const result = await $`gh pr view ${prNumber} --json number,title,body`;
        return JSON.parse(result.stdout);
    }

    // 最新の release PR を検索
    const existingPr = await findLatestReleasePr(base, head);
    if (existingPr) {
        return existingPr;
    }

    // なければ新規作成
    console.log(`Creating new release PR: ${head} -> ${base}`);
    const result = await $`gh pr create --title ${newTitle} --body "" --base ${base} --head ${head} --draft`;

    // 作成した PR の番号を取得
    const output = result.stdout.trim();
    const match = output.match(/\/pull\/(\d+)/);
    if (!match) {
        throw new Error("Failed to extract PR number from gh pr create output");
    }
    const newPrNumber = match[1];

    // 作成した PR の情報を取得
    const prResult = await $`gh pr view ${newPrNumber} --json number,title,body`;
    return JSON.parse(prResult.stdout);
}

/**
 * PR にラベルを追加
 * @param {number} prNumber - PR 番号
 * @param {string | null} label - ラベル名
 * @returns {Promise<void>}
 */
export async function addLabelToPr(prNumber, label) {
    if (!label) {
        return;
    }

    console.log(`Adding label "${label}" to PR #${prNumber}`);
    await $`gh issue edit ${prNumber} --add-label ${label}`;
}
