#!/usr/bin/env zx

import { PassThrough } from "node:stream";
import { formatDifferences, fullDiff, mangleLikeCloudFormation } from "@aws-cdk/cloudformation-diff";
import { chalk } from "zx";

/**
 * Stack の差分を計算する
 * @param {string[]} stackNames - Stack 名のリスト
 * @param {Record<string, object>} cfnTemplates - CloudFormation template のマップ
 * @param {Record<string, object>} stackTemplates - CDK template のマップ
 * @returns {{templateDiff: Record<string, object>, editedStackCount: number}}
 */
export function calculateDiff(stackNames, cfnTemplates, stackTemplates) {
    console.log("##[group]Calculate Template Diff");

    const templateDiff = {};
    const filteredChangesCounts = {};
    let editedStackCount = 0;

    for (const stackName of stackNames) {
        const currentTemplate = cfnTemplates[stackName] ?? {};
        const newTemplate = stackTemplates[stackName];

        const rawDiff = fullDiff(currentTemplate, newTemplate);

        // CFn の GetStackTemplate API は U+0080 以上を '?' に潰して返すため、
        // 同じ変換を新テンプレートに施した版で再 diff し、phantom diff を除去する。
        // (@aws-cdk/toolkit-lib の formatStackDiffHelper と同等の処理)
        let activeDiff = rawDiff;
        let filteredCount = 0;
        if (rawDiff.differenceCount && newTemplate) {
            const mangledNewTemplate = JSON.parse(mangleLikeCloudFormation(JSON.stringify(newTemplate)));
            const mangledDiff = fullDiff(currentTemplate, mangledNewTemplate);
            filteredCount = Math.max(0, rawDiff.differenceCount - mangledDiff.differenceCount);
            if (filteredCount > 0) {
                activeDiff = mangledDiff;
            }
        }

        templateDiff[stackName] = activeDiff;
        filteredChangesCounts[stackName] = filteredCount;

        if (activeDiff.differenceCount) {
            editedStackCount += 1;
            console.log(`Stack ${stackName} has ${activeDiff.differenceCount} difference(s)${filteredCount > 0 ? ` (omitted ${filteredCount} mangled non-ASCII change(s))` : ""}`);
        } else {
            console.log(`Stack ${stackName} has no differences${filteredCount > 0 ? ` (omitted ${filteredCount} mangled non-ASCII change(s))` : ""}`);
        }
    }

    console.log(`Total stacks with changes: ${editedStackCount}/${stackNames.length}`);
    console.log("##[endgroup]");

    return { templateDiff, editedStackCount, filteredChangesCounts };
}

/**
 * 差分をフォーマットして文字列として取得する
 * @param {object} diff - fullDiff の結果
 * @returns {string} フォーマットされた差分文字列
 */
export function formatDiff(diff) {
    if (diff.isEmpty) {
        return chalk.green("There were no differences");
    }

    const stream = new PassThrough();
    const streamChunks = [];
    stream.on("data", (chunk) => streamChunks.push(Buffer.from(chunk)));
    formatDifferences(stream, diff, {});

    return Buffer.concat(streamChunks).toString("utf8");
}

/**
 * ANSI エスケープコードを削除する
 * @param {string} text - 削除対象のテキスト
 * @returns {string} ANSI エスケープコードを削除したテキスト
 */
export function removeAnsiEscapes(text) {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: This regex is used to remove ANSI escape codes from the diff output for cleaner PR comments.
    return text.replace(/[\u001b\u009b][[()#;?]*(?:\d{1,4}(?:;\d{0,4})*)?[\dA-ORZcf-nqry=><]/g, "");
}
