#!/usr/bin/env zx

import { ResourceImpact } from "@aws-cdk/cloudformation-diff";
import { formatDiff, removeAnsiEscapes } from "./diff-calculator.mjs";

/**
 * PR コメントの見出しを生成する
 * @param {string} environmentAlias - 環境の別名（AWS アカウント名または環境名）
 * @returns {string} コメントの見出し
 */
export function getCommentHeading(environmentAlias) {
    return `## 🌎 Cloudformation Stack Diff (${environmentAlias})`;
}

/**
 * PR コメントを生成する
 * @param {object} params - パラメータ
 * @param {string} params.environmentAlias - 環境の別名（AWS アカウント名または環境名）
 * @param {string} params.awsRegion - AWS リージョン
 * @param {string} params.gitHubActionUrl - GitHub Actions の実行 URL
 * @param {string[]} params.stackNames - Stack 名のリスト
 * @param {string[]} params.cfnStackNames - CloudFormation に既に存在する Stack 名
 * @param {Record<string, object>} params.templateDiff - Stack 差分のマップ
 * @param {Record<string, object>} params.stackTemplates - CDK template のマップ
 * @param {Record<string, Record<string, object>>} params.cfnStackResourcesSummaries - Stack リソースのマップ
 * @param {object} params.cfnStacks - CloudFormation の Stack 一覧
 * @param {number} params.editedStackCount - 変更があった Stack の数
 * @param {boolean} params.stackDriftDetected - Drift が検出されたかどうか
 * @returns {string} PR コメント
 */
export function formatComment({
    environmentAlias,
    awsRegion,
    gitHubActionUrl,
    stackNames,
    cfnStackNames,
    templateDiff,
    stackTemplates,
    cfnStackResourcesSummaries,
    cfnStacks,
    editedStackCount,
    stackDriftDetected,
}) {
    const messageHeading = getCommentHeading(environmentAlias);
    let comment = `${messageHeading}\n\n\n`;

    // GitHub Actions へのリンク
    comment += `[View GitHub Action](${gitHubActionUrl})\n\n`;

    // 表や絵文字の説明
    comment += formatLegend();

    // Stack の概要
    comment += formatStacksSummary(editedStackCount, stackDriftDetected);

    // 各 Stack の詳細
    for (const stackName of stackNames) {
        comment += formatStackDetail({
            stackName,
            cfnStackNames,
            templateDiff,
            stackTemplates,
            cfnStackResourcesSummaries,
            cfnStacks,
            awsRegion,
        });
    }

    return comment;
}

/**
 * 凡例のセクションを生成する
 * @returns {string} 凡例
 */
function formatLegend() {
    return (
        "<details>\n" +
        "<summary>表や絵文字の意味</summary>\n" +
        "\n" +
        "> ### 差分の絵文字の意味\n" +
        "> - 🈚 変更なし\n" +
        "> - 🆕 新規追加\n" +
        "> - ✏️ 変更あり\n" +
        "> - ♻️ 変更あり（置換 : CFnによってリソースが一旦削除され再作成される）\n" +
        "> - 🗑 削除 (DeletionPolicy が Retain のもの、実際のリソースは削除されない)\n" +
        "> - 🔥 削除 (DeletionPolicy が Retain 以外、CFn によってリソースが削除される) \n" +
        "> \n" +
        "> ### Drift の意味\n" +
        "> - ︎ ⚠ NOT_CHECKED （未対応等でドリフト検知できない）\n" +
        "> - 🚨 MODIFIED （実際のリソースと CFn テンプレートに差異がある）\n" +
        "> - ✅ IN_SYNC（ドリフトがない）\n" +
        "> - 空欄（未作成のリソースなど）\n" +
        "> ### タイプ\n" +
        "> リソースの種類。 `AWS::CDK::Metadata` や `Custom::*` は CDK 上のメタデータで CFn 以外にリソースが作成されることはない。\n" +
        "> よってそれらのリソースはドリフトが NOT_CHECKED になる\n" +
        "\n" +
        "</details>\n\n"
    );
}

/**
 * Stack の概要セクションを生成する
 * @param {number} editedStackCount - 変更があった Stack の数
 * @param {boolean} stackDriftDetected - Drift が検出されたかどうか
 * @returns {string} Stack 概要
 */
function formatStacksSummary(editedStackCount, stackDriftDetected) {
    return (
        `### Stacks ${editedStackCount === 0 ? "(No Changes) " : ""}${
            stackDriftDetected ? "🚨 **Stack Drift Detected** 🚨" : ""
        }\n\n`
    );
}

/**
 * 個別の Stack の詳細を生成する
 * @param {object} params - パラメータ
 * @returns {string} Stack 詳細
 */
function formatStackDetail({
    stackName,
    cfnStackNames,
    templateDiff,
    stackTemplates,
    cfnStackResourcesSummaries,
    cfnStacks,
    awsRegion,
}) {
    let comment = "";

    // Stack の状態を判定
    let status;
    if (cfnStackNames.includes(stackName)) {
        status = templateDiff[stackName].differenceCount > 0 ? "diff" : "not_changed";
    } else {
        status = "new";
    }

    // Stack の見出し
    const stackNamePrefix = {
        new: "🆕",
        diff: "✏️",
        not_changed: "🈚",
    }[status];

    if (status !== "new") {
        const stackId = cfnStacks.StackSummaries.find((s) => s.StackName === stackName).StackId;
        const stackUrl = `https://${awsRegion}.console.aws.amazon.com/cloudformation/home?region=${awsRegion}#/stacks/stackinfo?stackId=${encodeURI(
            stackId,
        )}`;
        const driftUrl = `https://${awsRegion}.console.aws.amazon.com/cloudformation/home?region=${awsRegion}#/stacks/drifts?stackId=${encodeURI(
            stackName,
        )}`;
        comment += `#### ${stackNamePrefix} [${stackName}](${stackUrl}) [ドリフト検知](${driftUrl})\n`;
    } else {
        comment += `#### ${stackNamePrefix} ${stackName}\n`;
    }

    // cdk diff 結果
    const formattedDiff = formatDiff(templateDiff[stackName]);
    const cleanDiff = removeAnsiEscapes(formattedDiff);

    // GitHub Actions のログに出力（折りたたみ）
    console.log(`##[group]Stack ${stackName} diff`);
    console.log(formattedDiff);
    console.log("##[endgroup]");

    comment += "<details>\n";
    comment += "<summary>cdk diff</summary>\n\n";
    comment += "```\n";
    comment += cleanDiff;
    comment += "\n```\n\n";
    comment += "</details>\n\n";

    // リソースの表
    comment += formatResourcesTable({
        stackName,
        status,
        templateDiff,
        stackTemplates,
        cfnStackResourcesSummaries,
    });

    return comment;
}

/**
 * リソースの表を生成する
 * @param {object} params - パラメータ
 * @returns {string} リソーステーブル
 */
function formatResourcesTable({ stackName, status, templateDiff, stackTemplates, cfnStackResourcesSummaries }) {
    let comment = "";

    comment += "|差分|Drift|タイプ|論理ID|\n";
    comment += "|---|---|---|---|\n";

    const cfnResources = cfnStackResourcesSummaries[stackName] ?? {};

    // 差分が全くないと templateDiff[stackName].resources.diffs は空になる
    const logicalIds = Object.keys(status === "not_changed" ? cfnResources : templateDiff[stackName].resources.diffs);

    for (const logicalId of logicalIds) {
        const change = templateDiff[stackName].resources.diffs[logicalId];
        const diffMsg = formatDiffMessage(change);
        const driftMsg = formatDriftMessage(cfnResources[logicalId]);
        const type = getResourceType(change, stackTemplates[stackName], logicalId);

        comment += `|${diffMsg}|${driftMsg}|${type}|${logicalId}|\n`;
    }

    comment += "\n\n\n";

    return comment;
}

/**
 * 差分メッセージを生成する
 * @param {object} change - 差分情報
 * @returns {string} 差分メッセージ
 */
function formatDiffMessage(change) {
    switch (change?.changeImpact) {
        case ResourceImpact.WILL_UPDATE:
            return "✏️ Update"; // 変更
        case ResourceImpact.WILL_CREATE:
            return "🆕 Create"; // 追加
        case ResourceImpact.WILL_REPLACE:
            return "♻️ Replace";
        case ResourceImpact.MAY_REPLACE:
            return "♻️ May Replace";
        case ResourceImpact.WILL_DESTROY:
            return "🔥 Destroy"; // 実際のリソースも削除
        case ResourceImpact.WILL_ORPHAN:
            return "🗑 Remove"; // スタックから削除
        default:
            return "";
    }
}

/**
 * Drift メッセージを生成する
 * @param {object} resource - リソース情報
 * @returns {string} Drift メッセージ
 */
function formatDriftMessage(resource) {
    const driftStatus = resource?.DriftInformation?.StackResourceDriftStatus;

    if (driftStatus === "NOT_CHECKED") {
        return "⚠ NOT_CHECKED";
    }
    if (driftStatus === "MODIFIED") {
        return "🚨 MODIFIED";
    }
    if (driftStatus === "IN_SYNC") {
        return "✅ IN_SYNC";
    }
    return driftStatus ?? "";
}

/**
 * リソースタイプを取得する
 * @param {object} change - 差分情報
 * @param {object} stackTemplate - Stack template
 * @param {string} logicalId - 論理 ID
 * @returns {string} リソースタイプ
 */
function getResourceType(change, stackTemplate, logicalId) {
    if (change?.resourceTypes?.newType) {
        return change.resourceTypes.newType;
    }
    if (stackTemplate?.Resources?.[logicalId]) {
        return stackTemplate.Resources[logicalId].Type;
    }
    return "";
}
