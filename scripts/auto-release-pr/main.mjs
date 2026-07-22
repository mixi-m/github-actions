#!/usr/bin/env zx

/**
 * Auto Release PR のメインスクリプト
 * Release PR の body を自動的に更新する
 * GitHub CLI (gh) を使用
 */

import { appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { getConfig } from "./config.mjs";
import { findOrCreateReleasePr, addLabelToPr } from "./pr-finder.mjs";
import { analyzeMergedPrs, isBackportPr } from "./commit-analyzer.mjs";
import { generatePrBody } from "./body-generator.mjs";
import { updatePrBody } from "./pr-updater.mjs";

/**
 * GITHUB_OUTPUT に複数行の値を書き込む
 * @param {string} name - 出力名
 * @param {string} value - 出力値（複数行可）
 */
function appendMultilineOutput(name, value) {
    const delimiter = randomUUID();
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

async function main() {
    try {
        console.log("=== Auto Release PR ===\n");

        // 設定を取得
        const config = getConfig();

        console.log(`Base Branch: ${config.baseBranch}`);
        console.log(`Head Branch: ${config.headBranch}`);
        if (config.releasePRNumber) {
            console.log(`Release PR Number: ${config.releasePRNumber}`);
        }
        console.log("");

        // 1. Release PR を検索または作成
        const releasePr = await findOrCreateReleasePr(
            config.baseBranch,
            config.headBranch,
            config.releasePRNumber,
            config.newReleasePRTitle
        );

        console.log(`\nRelease PR: #${releasePr.number} - ${releasePr.title}`);

        // 後続ジョブ（AI によるタイトル生成）が同じ Release PR を参照できるように出力する
        if (process.env.GITHUB_OUTPUT) {
            appendFileSync(process.env.GITHUB_OUTPUT, `pr-number=${releasePr.number}\n`);
        }

        // 2. ラベルを追加
        await addLabelToPr(releasePr.number, config.releasePRLabel);

        // 3. マージされた PR を解析
        const mergedPrs = await analyzeMergedPrs(releasePr.number);

        // AI によるタイトル生成向けに、backport PR を除いた一覧を出力する
        // (backport PR のタイトルはリリース内容の要約として意味を持たないノイズのため)
        if (process.env.GITHUB_OUTPUT) {
            const titlePrs = mergedPrs.filter((pr) => !isBackportPr(pr.title));
            const titleSummary =
                titlePrs.length > 0
                    ? titlePrs.map((pr) => `- #${pr.number}: ${pr.title}`).join("\n")
                    : "(実質的な変更なし)";
            appendMultilineOutput("title-summary", titleSummary);
        }

        // 4. 新しい PR body を生成
        const newBody = generatePrBody(mergedPrs, config.bodyTemplate);

        if (!newBody) {
            console.error("\n❌ Failed to generate new PR body.");
            console.error("No merged PRs found in the release PR.");
            process.exit(1);
        }

        console.log("\nGenerated PR body:");
        console.log("---");
        console.log(newBody);
        console.log("---");

        // 5. PR body を更新し、diff をコメント
        await updatePrBody(
            releasePr,
            newBody,
            config.commentTemplate
        );

        console.log("\n=== Auto Release PR Completed Successfully ===");
    } catch (error) {
        console.error("\n❌ Error occurred:");
        console.error(error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// メインスクリプトを実行
main();
