#!/usr/bin/env zx

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
    };
}
