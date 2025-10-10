#!/usr/bin/env zx

/**
 * CDK Stack Diff を PR にコメントするメインスクリプト
 */

import { getConfig, getEnvironmentAlias } from "./config.mjs";
import { getCdkTemplates } from "./cdk-template.mjs";
import { getCfnTemplates, getCfnStackResources } from "./cfn-template.mjs";
import { calculateDiff } from "./diff-calculator.mjs";
import { detectStackDrift } from "./drift-detector.mjs";
import { formatComment } from "./comment-formatter.mjs";
import { updatePrComment } from "./pr-comment.mjs";

async function main() {
    try {
        console.log("=== CDK Diff on PR ===\n");

        // 設定を取得
        const config = getConfig();
        const environmentAlias = getEnvironmentAlias();

        console.log(`Environment: ${environmentAlias}`);
        console.log(`AWS Account: ${config.awsAccount}`);
        console.log(`AWS Region: ${config.awsRegion}`);
        console.log(`PR Number: ${config.prNumber}`);
        console.log(`Repository: ${config.gitHubRepository}\n`);

        // 1. CDK で template を出力
        const { stackNames, stackTemplates } = await getCdkTemplates();

        // 2. CloudFormation 上の Stack Template を取得
        const { cfnStackNames, cfnTemplates, cfnStacks } = await getCfnTemplates(stackNames);

        // 3. Stack の差分を計算
        const { templateDiff, editedStackCount } = calculateDiff(stackNames, cfnTemplates, stackTemplates);

        // 4. Stack の Drift を検知
        const stackDriftDetected = await detectStackDrift(stackNames, cfnStackNames, config.driftDetectionTimeout);

        // 5. CloudFormation 上のスタックリソースを取得
        const cfnStackResourcesSummaries = await getCfnStackResources(cfnStackNames);

        // 6. PR コメントを生成
        const comment = formatComment({
            environmentAlias,
            awsRegion: config.awsRegion,
            gitHubActionUrl: config.gitHubActionUrl,
            stackNames,
            cfnStackNames,
            templateDiff,
            stackTemplates,
            cfnStackResourcesSummaries,
            cfnStacks,
            editedStackCount,
            stackDriftDetected,
        });

        // 7. PR にコメントを投稿
        await updatePrComment({
            gitHubRepository: config.gitHubRepository,
            prNumber: config.prNumber,
            environmentAlias,
            comment,
        });

        console.log("\n=== CDK Diff on PR Completed Successfully ===");
    } catch (error) {
        console.error("\n❌ Error occurred:");
        console.error(error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// メインスクリプトを実行
main();
