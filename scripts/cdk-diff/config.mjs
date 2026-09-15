#!/usr/bin/env zx

import { $ } from "zx";

/**
 * 設定管理モジュール
 * 環境変数から設定を読み込む
 */

/**
 * AWS アカウントマッピングを取得
 * @returns {Record<string, string>} AWS アカウント ID からアカウント名へのマッピング
 */
export function getAwsAccountNameMap() {
    const accountMapping = process.env.AWS_ACCOUNT_MAPPING;
    if (!accountMapping) {
        throw new Error("AWS_ACCOUNT_MAPPING environment variable is required");
    }

    try {
        // JSON 形式で渡される: [{"id": "123456789", "name": "staging"}, ...]
        const accounts = JSON.parse(accountMapping);
        const map = {};
        for (const account of accounts) {
            map[account.id] = account.name;
        }
        return map;
    } catch (error) {
        throw new Error(`Failed to parse AWS_ACCOUNT_MAPPING: ${error.message}`);
    }
}

/**
 * 現在の AWS アカウント ID を取得
 * @returns {string} AWS アカウント ID
 */
export function getAwsAccount() {
    const account = process.env.AWS_ACCOUNT;
    if (!account) {
        throw new Error("AWS_ACCOUNT environment variable is required");
    }
    return account;
}

/**
 * AWS リージョンを取得
 * @returns {string} AWS リージョン
 */
export function getAwsRegion() {
    return process.env.AWS_REGION || "ap-northeast-1";
}

/**
 * Stack drift 検知のタイムアウト時間を取得（ミリ秒）
 * @returns {number} タイムアウト時間（ミリ秒）
 */
export function getDriftDetectionTimeout() {
    const timeout = process.env.DRIFT_DETECTION_TIMEOUT_SEC || "300";
    return Number.parseInt(timeout, 10) * 1000;
}

/**
 * GitHub の PR 番号を取得
 * @returns {string} PR 番号
 */
export function getPrNumber() {
    const prNumber = process.env.PR_NUMBER;
    if (!prNumber) {
        throw new Error("PR_NUMBER environment variable is required");
    }
    return prNumber;
}

/**
 * GitHub リポジトリ名を取得
 * @returns {string} リポジトリ名（例: "owner/repo"）
 */
export function getGitHubRepository() {
    const repo = process.env.GITHUB_REPOSITORY;
    if (!repo) {
        throw new Error("GITHUB_REPOSITORY environment variable is required");
    }
    return repo;
}

/**
 * GitHub Actions の実行 URL を取得
 * @returns {string} GitHub Actions の実行 URL
 */
export function getGitHubActionUrl() {
    const serverUrl = process.env.GITHUB_SERVER_URL || "https://github.com";
    const repo = getGitHubRepository();
    const runId = process.env.GITHUB_RUN_ID;

    if (!runId) {
        throw new Error("GITHUB_RUN_ID environment variable is required");
    }

    return `${serverUrl}/${repo}/actions/runs/${runId}`;
}

/**
 * 環境のエイリアス名を取得
 * ENV_NAME が設定されている場合はそれを使用（環境名ベース）
 * なければ AWS アカウント名を使用（アカウント ID ベース）
 * @returns {string} 環境のエイリアス名
 */
export function getEnvironmentAlias() {
    // ENV_NAME が設定されていればそれを使用（環境名ベース）
    const envName = process.env.ENV_NAME;
    if (envName) {
        return envName;
    }

    // なければ AWS アカウント名を使用（アカウント ID ベース）
    const account = getAwsAccount();
    const map = getAwsAccountNameMap();
    return map[account];
}

/**
 * CDK Context パラメータを取得
 * @returns {string} CDK Context パラメータ（例: "env"）
 */
export function getCdkContext() {
    return process.env.CDK_CONTEXT || "";
}

/**
 * PR コメントの詳細度を取得
 * "full" | "summary" 以外の値、または未指定の場合は既存動作を維持するため "full" にフォールバックする
 * @returns {"full"|"summary"} コメントモード
 */
export function getCommentMode() {
    return process.env.COMMENT_MODE === "summary" ? "summary" : "full";
}

/**
 * 現在の Matrix Job（環境ごと）の Actions ログ URL を取得する
 * summary モードでコメントから省略した詳細への導線に使う。
 * 取得に失敗した場合は run 全体の URL にフォールバックする（diff 自体は失敗させない）
 * @returns {Promise<string>} ジョブのログ URL
 */
export async function getGitHubJobUrl() {
    const fallback = getGitHubActionUrl();
    const runId = process.env.GITHUB_RUN_ID;
    if (!runId) {
        return fallback;
    }

    try {
        const repo = getGitHubRepository();
        const result = await $`gh api repos/${repo}/actions/runs/${runId}/jobs`;
        const { jobs } = JSON.parse(result.stdout);

        const envName = process.env.ENV_NAME;
        const job = envName ? jobs.find((j) => j.name.includes(envName)) : undefined;

        return job?.html_url ?? fallback;
    } catch (error) {
        console.log(`Failed to resolve job URL, falling back to run URL: ${error.message}`);
        return fallback;
    }
}

/**
 * すべての設定を取得
 * @returns {object} 設定オブジェクト
 */
export function getConfig() {
    return {
        awsAccountNameMap: getAwsAccountNameMap(),
        awsAccount: getAwsAccount(),
        awsRegion: getAwsRegion(),
        driftDetectionTimeout: getDriftDetectionTimeout(),
        prNumber: getPrNumber(),
        gitHubRepository: getGitHubRepository(),
        gitHubActionUrl: getGitHubActionUrl(),
        commentMode: getCommentMode(),
    };
}
