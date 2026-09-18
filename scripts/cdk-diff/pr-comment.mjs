#!/usr/bin/env zx

import { $, fs } from "zx";
import { getCommentHeading } from "./comment-formatter.mjs";

// GitHub の Issue/PR コメントは 65536 文字が上限。ちょうどの値だと不安定なため余裕を持たせる。
const SAFE_COMMENT_SIZE = 60000;

/**
 * コメントが GitHub の上限を超える場合、安全な位置で切り詰める。
 * 上限超過による投稿失敗を避けるためのフォールバック。
 * コード行の途中や開いたままのコードフェンスで切れないよう配慮する。
 * @param {string} comment - 元のコメント本文
 * @returns {string} 上限内に収まるコメント本文
 */
export function truncateCommentIfNeeded(comment) {
    if (comment.length <= SAFE_COMMENT_SIZE) {
        return comment;
    }

    const cutAt = comment.lastIndexOf("\n", SAFE_COMMENT_SIZE);
    let truncated = comment.slice(0, cutAt === -1 ? SAFE_COMMENT_SIZE : cutAt);

    // 開いたままの ``` コードフェンスがあれば閉じる
    const fenceCount = (truncated.match(/^```/gm) ?? []).length;
    if (fenceCount % 2 === 1) {
        truncated += "\n```\n";
    }

    truncated +=
        "\n\n> ⚠️ **コメントが GitHub の上限（65536 文字）に達したため、ここで切り詰めています。** " +
        "完全な内容は本コメント冒頭の [View GitHub Action] のリンク先ログで確認してください。\n";

    return truncated;
}

/**
 * PR に既に投稿されている同じ見出しのコメントを削除する
 * @param {string} gitHubRepository - GitHub リポジトリ名（例: "owner/repo"）
 * @param {string} prNumber - PR 番号
 * @param {string} messageHeading - コメントの見出し
 */
export async function deletePreviousComments(gitHubRepository, prNumber, messageHeading) {
    console.log("##[group]Delete Previous Comments");

    try {
        const gh = await $`gh api /repos/${gitHubRepository}/issues/${prNumber}/comments`;
        const comments = JSON.parse(gh.stdout);

        const commentsIdToDelete = comments
            .filter((x) => x.user.login === "github-actions[bot]")
            .filter((x) => x.body.includes(messageHeading))
            .map((x) => x.id);

        console.log(`Found ${commentsIdToDelete.length} previous comment(s) to delete`);

        for (const id of commentsIdToDelete) {
            await $`gh api --method DELETE /repos/${gitHubRepository}/issues/comments/${id}`;
            console.log(`Deleted comment ID: ${id}`);
        }

        console.log("##[endgroup]");
    } catch (error) {
        console.log("##[endgroup]");
        throw new Error(`Failed to delete previous comments: ${error.message}`);
    }
}

/**
 * PR にコメントを投稿する
 * @param {string} prNumber - PR 番号
 * @param {string} comment - コメント本文
 */
export async function postComment(prNumber, comment) {
    console.log("##[group]Post PR Comment");

    try {
        const truncated = truncateCommentIfNeeded(comment);
        if (truncated.length !== comment.length) {
            console.log(`Comment truncated: ${comment.length} -> ${truncated.length} chars (limit: 65536)`);
        }

        // 一時ファイルにコメントを書き込む
        const tempFile = "/tmp/cdk-diff-comment.md";
        fs.writeFileSync(tempFile, truncated);

        // gh コマンドでコメントを投稿
        await $`gh pr comment ${prNumber} -F ${tempFile}`;

        console.log(`Successfully posted comment to PR #${prNumber}`);
        console.log("##[endgroup]");
    } catch (error) {
        console.log("##[endgroup]");
        throw new Error(`Failed to post PR comment: ${error.message}`);
    }
}

/**
 * PR にコメントを投稿する（過去のコメントを削除してから）
 * @param {object} params - パラメータ
 * @param {string} params.gitHubRepository - GitHub リポジトリ名
 * @param {string} params.prNumber - PR 番号
 * @param {string} params.environmentAlias - 環境の別名（AWS アカウント名または環境名）
 * @param {string} params.comment - コメント本文
 */
export async function updatePrComment({ gitHubRepository, prNumber, environmentAlias, comment }) {
    const messageHeading = getCommentHeading(environmentAlias);

    // 過去のコメントを削除
    await deletePreviousComments(gitHubRepository, prNumber, messageHeading);

    // 新しいコメントを投稿
    await postComment(prNumber, comment);
}
