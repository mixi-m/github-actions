#!/usr/bin/env zx

import { $, fs } from "zx";
import { getCommentHeading } from "./comment-formatter.mjs";

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
        // 一時ファイルにコメントを書き込む
        const tempFile = "/tmp/cdk-diff-comment.md";
        fs.writeFileSync(tempFile, comment);

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
