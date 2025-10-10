#!/usr/bin/env zx

import { PassThrough } from "node:stream";
import { formatDifferences, fullDiff } from "@aws-cdk/cloudformation-diff";
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
    let editedStackCount = 0;

    for (const stackName of stackNames) {
        const currentTemplate = cfnTemplates[stackName] ?? {};
        const newTemplate = stackTemplates[stackName];

        templateDiff[stackName] = fullDiff(currentTemplate, newTemplate);

        if (templateDiff[stackName].differenceCount) {
            editedStackCount += 1;
            console.log(`Stack ${stackName} has ${templateDiff[stackName].differenceCount} difference(s)`);
        } else {
            console.log(`Stack ${stackName} has no differences`);
        }
    }

    console.log(`Total stacks with changes: ${editedStackCount}/${stackNames.length}`);
    console.log("##[endgroup]");

    return { templateDiff, editedStackCount };
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
