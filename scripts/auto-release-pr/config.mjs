#!/usr/bin/env zx

/**
 * 設定管理モジュール
 * 環境変数から設定を読み込む
 */

/**
 * Base Branch を取得
 * @returns {string} Base Branch
 */
export function getBaseBranch() {
    return process.env.BASE_BRANCH || "release";
}

/**
 * Head Branch を取得
 * @returns {string} Head Branch
 */
export function getHeadBranch() {
    return process.env.HEAD_BRANCH || "master";
}

/**
 * Release PR 番号を取得
 * @returns {string | null} Release PR 番号（指定されていない場合は null）
 */
export function getReleasePRNumber() {
    return process.env.RELEASE_PR_NUMBER || null;
}

/**
 * PR Body テンプレートを取得
 * @returns {string} PR Body テンプレート
 */
export function getBodyTemplate() {
    return process.env.BODY_TEMPLATE || `## Changes

{summary}`;
}

/**
 * Comment テンプレートを取得
 * @returns {string} Comment テンプレート
 */
export function getCommentTemplate() {
    return process.env.COMMENT_TEMPLATE || `PR body is updated!
<details><summary>diff</summary>
<p>

\`\`\`diff
{diff}
\`\`\`

</p>
</details>`;
}

/**
 * Release PR Label を取得
 * @returns {string | null} Release PR Label（指定されていない場合は null）
 */
export function getReleasePRLabel() {
    return process.env.RELEASE_PR_LABEL || null;
}

/**
 * 新規 Release PR のタイトルを取得
 * @returns {string} 新規 Release PR のタイトル
 */
export function getNewReleasePRTitle() {
    return process.env.NEW_RELEASE_PR_TITLE || "[リリース]";
}

/**
 * すべての設定を取得
 * @returns {object} 設定オブジェクト
 */
export function getConfig() {
    return {
        baseBranch: getBaseBranch(),
        headBranch: getHeadBranch(),
        releasePRNumber: getReleasePRNumber(),
        bodyTemplate: getBodyTemplate(),
        commentTemplate: getCommentTemplate(),
        releasePRLabel: getReleasePRLabel(),
        newReleasePRTitle: getNewReleasePRTitle(),
    };
}
