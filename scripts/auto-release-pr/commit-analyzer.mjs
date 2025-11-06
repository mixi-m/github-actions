#!/usr/bin/env zx

/**
 * コミット解析モジュール
 * PR のコミットからマージコミットを抽出し、含まれる PR 情報を取得
 * GitHub CLI (gh) を使用
 */

/**
 * マージコミットメッセージから PR 番号を抽出
 * @param {string} message - コミットメッセージ
 * @returns {number | null} PR 番号（見つからない場合は null）
 */
function extractPrNumber(message) {
    const match = message.match(/#(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * PR のコミットを解析し、マージされた PR の情報を取得
 * @param {number} prNumber - 解析対象の PR 番号
 * @returns {Promise<Array<{number: number, title: string}>>} マージされた PR の配列
 */
export async function analyzeMergedPrs(prNumber) {
    console.log(`Analyzing commits for PR #${prNumber}...`);

    // PR のコミットを取得
    const result = await $`gh pr view ${prNumber} --json commits`;
    const data = JSON.parse(result.stdout);
    const commits = data.commits || [];

    console.log(`Found ${commits.length} commits`);

    // マージコミットを抽出
    const mergeCommits = commits.filter((commit) => {
        const message = commit.messageHeadline || "";
        return message.startsWith("Merge pull request");
    });
    console.log(`Found ${mergeCommits.length} merge commits`);

    // 各マージコミットから PR 情報を取得
    const mergedPrs = [];
    for (const commit of mergeCommits) {
        const message = commit.messageHeadline || "";
        const prNum = extractPrNumber(message);

        if (prNum) {
            try {
                const prResult = await $`gh pr view ${prNum} --json number,title`;
                const pr = JSON.parse(prResult.stdout);
                mergedPrs.push({
                    number: pr.number,
                    title: pr.title,
                });
                console.log(`  - #${pr.number}: ${pr.title}`);
            } catch (error) {
                console.error(`Failed to fetch PR #${prNum}:`, error.message);
            }
        }
    }

    return mergedPrs;
}
