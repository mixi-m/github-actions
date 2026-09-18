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
 * @param {"full"|"summary"} params.commentMode - コメントの詳細度
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
    filteredChangesCounts = {},
    commentMode = "full",
}) {
    // 完全版は常に Actions のログへ出す。summary モードでコメントから省いた行は
    // すべてここで辿れる（コメントだけにしか無い情報を作らないこと）。
    for (const stackName of stackNames) {
        logStackDiff(stackName, templateDiff);
        logStackResources({ stackName, templateDiff, stackTemplates, cfnStackResourcesSummaries });
    }

    const summary = commentMode === "summary";

    let comment = `${getCommentHeading(environmentAlias)}\n\n\n`;

    comment += `[View GitHub Action](${gitHubActionUrl})\n\n`;

    comment += formatLegend(summary);

    comment += formatStacksSummary(editedStackCount, stackDriftDetected);

    if (summary) {
        comment += formatStacksTable({ stackNames, cfnStackNames, templateDiff, cfnStackResourcesSummaries });
    }

    for (const stackName of stackNames) {
        // summary モードでは「差分なし かつ drift 異常なし」の Stack の節を出さない。
        // 一覧表に 1 行残るので存在は失われず、内訳はログにある。
        if (summary && !needsDetailSection({ stackName, cfnStackNames, templateDiff, cfnStackResourcesSummaries })) {
            continue;
        }

        comment += formatStackDetail({
            stackName,
            cfnStackNames,
            templateDiff,
            stackTemplates,
            cfnStackResourcesSummaries,
            cfnStacks,
            awsRegion,
            filteredChangesCount: filteredChangesCounts[stackName] ?? 0,
            summary,
            gitHubActionUrl,
        });
    }

    if (summary) {
        comment += `> 差分のない Stack の詳細は省略しています。全 Stack の全リソース一覧と Drift は [Actions のログ](${gitHubActionUrl}) の \`Stack <name> resources\` グループに出力しています。\n`;
    }

    return comment;
}

function logStackDiff(stackName, templateDiff) {
    console.log(`##[group]Stack ${stackName} diff`);
    console.log(formatDiff(templateDiff[stackName]));
    console.log("##[endgroup]");
}

function logStackResources({ stackName, templateDiff, stackTemplates, cfnStackResourcesSummaries }) {
    console.log(`##[group]Stack ${stackName} resources`);

    const cfnResources = cfnStackResourcesSummaries[stackName] ?? {};
    const diffs = templateDiff[stackName]?.resources?.diffs ?? {};
    const logicalIds = [...new Set([...Object.keys(cfnResources), ...Object.keys(diffs)])].sort();

    console.log(`${logicalIds.length} resource(s)`);
    for (const logicalId of logicalIds) {
        const change = diffs[logicalId];
        const diffMsg = formatDiffMessage(change) || "-";
        const driftMsg = formatDriftMessage(cfnResources[logicalId]) || "-";
        const type = getResourceType(change, stackTemplates[stackName], logicalId) || "-";
        console.log(`${diffMsg}\t${driftMsg}\t${type}\t${logicalId}`);
    }

    console.log("##[endgroup]");
}

function needsDetailSection({ stackName, cfnStackNames, templateDiff, cfnStackResourcesSummaries }) {
    if (!cfnStackNames.includes(stackName)) {
        return true;
    }
    if (templateDiff[stackName].differenceCount > 0) {
        return true;
    }
    return countDriftStatuses(cfnStackResourcesSummaries[stackName]).modified > 0;
}

function countDriftStatuses(cfnResources) {
    const counts = { modified: 0, notChecked: 0, inSync: 0, total: 0 };
    for (const resource of Object.values(cfnResources ?? {})) {
        counts.total += 1;
        const status = resource?.DriftInformation?.StackResourceDriftStatus;
        if (status === "MODIFIED") counts.modified += 1;
        else if (status === "NOT_CHECKED") counts.notChecked += 1;
        else if (status === "IN_SYNC") counts.inSync += 1;
    }
    return counts;
}

function summarizeChanges(diff) {
    const counts = new Map();
    const changedIds = [];
    for (const [logicalId, change] of Object.entries(diff?.resources?.diffs ?? {})) {
        const label = formatDiffMessage(change);
        if (!label) continue;
        changedIds.push(logicalId);
        const emoji = label.split(" ")[0];
        counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
    }
    const parts = [...counts.entries()].map(([emoji, n]) => `${emoji}${n}`);
    const otherCount = (diff?.differenceCount ?? 0) - changedIds.length;
    if (otherCount > 0) parts.push(`その他${otherCount}`);
    return { label: parts.length > 0 ? parts.join(" ") : "—", changedIds };
}

function getStackConsoleUrls(cfnStacks, stackName, awsRegion) {
    const stackId = cfnStacks.StackSummaries.find((s) => s.StackName === stackName).StackId;
    const base = `https://${awsRegion}.console.aws.amazon.com/cloudformation/home?region=${awsRegion}`;
    return {
        stackUrl: `${base}#/stacks/stackinfo?stackId=${encodeURI(stackId)}`,
        driftUrl: `${base}#/stacks/drifts?stackId=${encodeURI(stackName)}`,
    };
}

function formatLegend(summary) {
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
        (summary
            ? "> ### 一覧表\n" +
              "> 変更列は変更のあったリソース数の内訳。Drift 列は Stack 内リソースの最も重い状態。\n" +
              "> 差分のない Stack は詳細を省略し、一覧表の行のみになる。\n"
            : "") +
        "\n" +
        "</details>\n\n"
    );
}

function formatStacksSummary(editedStackCount, stackDriftDetected) {
    return `### Stacks ${editedStackCount === 0 ? "(No Changes) " : ""}${
        stackDriftDetected ? "🚨 **Stack Drift Detected** 🚨" : ""
    }\n\n`;
}

function formatStacksTable({ stackNames, cfnStackNames, templateDiff, cfnStackResourcesSummaries }) {
    let comment = "||Stack|変更|Drift|\n|---|---|---|---|\n";

    for (const stackName of stackNames) {
        const isNew = !cfnStackNames.includes(stackName);
        const diff = templateDiff[stackName];
        const statusEmoji = isNew ? "🆕" : diff.differenceCount > 0 ? "✏️" : "🈚";

        const { label } = summarizeChanges(diff);

        const drift = countDriftStatuses(cfnStackResourcesSummaries[stackName]);
        let driftCell = "";
        if (drift.modified > 0) driftCell = `🚨 MODIFIED (${drift.modified})`;
        else if (drift.total > 0) driftCell = "✅";

        comment += `|${statusEmoji}|${stackName}|${label}|${driftCell}|\n`;
    }

    return `${comment}\n\n`;
}

function formatStackDetail({
    stackName,
    cfnStackNames,
    templateDiff,
    stackTemplates,
    cfnStackResourcesSummaries,
    cfnStacks,
    awsRegion,
    filteredChangesCount = 0,
    summary = false,
    gitHubActionUrl = "",
}) {
    let comment = "";

    let status;
    if (cfnStackNames.includes(stackName)) {
        status = templateDiff[stackName].differenceCount > 0 ? "diff" : "not_changed";
    } else {
        status = "new";
    }

    const stackNamePrefix = { new: "🆕", diff: "✏️", not_changed: "🈚" }[status];

    if (status !== "new") {
        const { stackUrl, driftUrl } = getStackConsoleUrls(cfnStacks, stackName, awsRegion);
        comment += `#### ${stackNamePrefix} [${stackName}](${stackUrl}) [ドリフト検知](${driftUrl})\n`;
    } else {
        comment += `#### ${stackNamePrefix} ${stackName}\n`;
    }

    if (!summary || status !== "not_changed") {
        const cleanDiff = removeAnsiEscapes(formatDiff(templateDiff[stackName]));

        comment += "<details>\n";
        comment += "<summary>cdk diff</summary>\n\n";
        comment += "```\n";
        comment += cleanDiff;
        if (filteredChangesCount > 0) {
            comment += `\nOmitted ${filteredChangesCount} change(s) because they are likely mangled non-ASCII characters. Use --strict to print them.`;
        }
        comment += "\n```\n\n";
        comment += "</details>\n\n";
    }

    comment += formatResourcesTable({
        stackName,
        status,
        templateDiff,
        stackTemplates,
        cfnStackResourcesSummaries,
        summary,
        gitHubActionUrl,
    });

    return comment;
}

function formatResourcesTable({
    stackName,
    status,
    templateDiff,
    stackTemplates,
    cfnStackResourcesSummaries,
    summary = false,
    gitHubActionUrl = "",
}) {
    const cfnResources = cfnStackResourcesSummaries[stackName] ?? {};
    const diffs = templateDiff[stackName].resources.diffs;

    let logicalIds = Object.keys(status === "not_changed" ? cfnResources : diffs);
    let omittedNotChecked = 0;

    if (summary) {
        const kept = [];
        for (const logicalId of new Set([...Object.keys(diffs), ...Object.keys(cfnResources)])) {
            const driftStatus = cfnResources[logicalId]?.DriftInformation?.StackResourceDriftStatus;
            const hasChange = formatDiffMessage(diffs[logicalId]) !== "";
            if (hasChange || driftStatus === "MODIFIED") {
                kept.push(logicalId);
            } else {
                omittedNotChecked += 1;
            }
        }
        logicalIds = kept.sort();
    }

    if (logicalIds.length === 0 && summary) {
        return "\n\n";
    }

    let comment = summary ? "<details>\n<summary>リソース</summary>\n\n" : "";

    comment += "|差分|Drift|タイプ|論理ID|\n";
    comment += "|---|---|---|---|\n";

    for (const logicalId of logicalIds) {
        const change = diffs[logicalId];
        const diffMsg = formatDiffMessage(change);
        const driftMsg = formatDriftMessage(cfnResources[logicalId]);
        const type = getResourceType(change, stackTemplates[stackName], logicalId);
        comment += `|${diffMsg}|${driftMsg}|${type}|${logicalId}|\n`;
    }

    if (summary) {
        if (omittedNotChecked > 0) {
            comment += `\n変更も Drift も無いリソース ${omittedNotChecked} 件を省略しています（全件は [ログ](${gitHubActionUrl}) の \`Stack ${stackName} resources\`）。\n`;
        }
        comment += "\n</details>\n";
    }

    comment += "\n\n\n";
    return comment;
}

function formatDiffMessage(change) {
    switch (change?.changeImpact) {
        case ResourceImpact.WILL_UPDATE:
            return "✏️ Update";
        case ResourceImpact.WILL_CREATE:
            return "🆕 Create";
        case ResourceImpact.WILL_REPLACE:
            return "♻️ Replace";
        case ResourceImpact.MAY_REPLACE:
            return "♻️ May Replace";
        case ResourceImpact.WILL_DESTROY:
            return "🔥 Destroy";
        case ResourceImpact.WILL_ORPHAN:
            return "🗑 Remove";
        default:
            return "";
    }
}

function formatDriftMessage(resource) {
    const driftStatus = resource?.DriftInformation?.StackResourceDriftStatus;
    if (driftStatus === "NOT_CHECKED") return "⚠ NOT_CHECKED";
    if (driftStatus === "MODIFIED") return "🚨 MODIFIED";
    if (driftStatus === "IN_SYNC") return "✅ IN_SYNC";
    return driftStatus ?? "";
}

function getResourceType(change, stackTemplate, logicalId) {
    if (change?.resourceTypes?.newType) return change.resourceTypes.newType;
    if (stackTemplate?.Resources?.[logicalId]) return stackTemplate.Resources[logicalId].Type;
    return "";
}
