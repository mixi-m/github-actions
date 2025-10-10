#!/usr/bin/env zx

import { $, fs } from "zx";

/**
 * CDK で template を出力し、Stack 名と template を取得する
 * @returns {Promise<{stackNames: string[], stackTemplates: Record<string, object>}>}
 */
export async function getCdkTemplates() {
    console.log("##[group]CDK Synth");

    try {
        // CDK Context パラメータを取得
        const cdkContext = process.env.CDK_CONTEXT || "";
        const envName = process.env.ENV_NAME || "";

        // CDK Synth コマンドを構築
        let synthCommand;
        if (cdkContext && envName) {
            // 環境名ベースの場合（例: npm run -- cdk synth --context env=staging）
            synthCommand = `npm run -- cdk synth --context ${cdkContext}=${envName}`;
            console.log(`Running CDK synth with context: ${cdkContext}=${envName}`);
        } else {
            // デフォルト（例: npx cdk synth）
            synthCommand = "npx cdk synth";
            console.log("Running CDK synth without context");
        }

        // CDK で template を出力
        await $([synthCommand]);

        // Manifest から Stack 名を取得
        const cdkManifest = JSON.parse(fs.readFileSync("cdk.out/manifest.json").toString("utf-8"));
        const stackNames = Object.entries(cdkManifest.artifacts)
            .filter(([, v]) => v.type === "aws:cloudformation:stack")
            .map(([k]) => k);

        console.log(`Found ${stackNames.length} stacks: ${stackNames.join(", ")}`);

        // 各 Stack の template を読み込む
        const stackTemplates = {};
        for (const stackName of stackNames) {
            const templatePath = `cdk.out/${stackName}.template.json`;
            stackTemplates[stackName] = JSON.parse(fs.readFileSync(templatePath).toString());
            console.log(`Loaded template for stack: ${stackName}`);
        }

        console.log("##[endgroup]");

        return { stackNames, stackTemplates };
    } catch (error) {
        console.log("##[endgroup]");
        throw new Error(`Failed to get CDK templates: ${error.message}`);
    }
}
