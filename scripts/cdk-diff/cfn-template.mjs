#!/usr/bin/env zx

import { $ } from "zx";

/**
 * CloudFormation 上の Stack Template を取得する
 * @param {string[]} stackNames - 取得対象の Stack 名のリスト
 * @returns {Promise<{cfnStackNames: string[], cfnTemplates: Record<string, object>, cfnStacks: object}>}
 */
export async function getCfnTemplates(stackNames) {
    console.log("##[group]Get CloudFormation Templates");

    try {
        // CFn 上の Stack 一覧を取得
        const cfnStacks = JSON.parse((await $`aws cloudformation list-stacks`).stdout);

        // 削除済みまたはレビュー中のスタックを除外
        const cfnStackNames = cfnStacks.StackSummaries.filter(
            (s) => s.StackStatus !== "DELETE_COMPLETE" && s.StackStatus !== "REVIEW_IN_PROGRESS",
        )
            .map((x) => x.StackName)
            .filter((x) => stackNames.includes(x));

        console.log(`Found ${cfnStackNames.length} existing CloudFormation stacks: ${cfnStackNames.join(", ")}`);

        // 各 Stack の template を取得
        const cfnTemplates = {};
        for (const stackName of cfnStackNames) {
            const command = await $`aws cloudformation get-template --stack-name ${stackName}`;
            cfnTemplates[stackName] = JSON.parse(command.stdout).TemplateBody;
            console.log(`Loaded CloudFormation template for stack: ${stackName}`);
        }

        console.log("##[endgroup]");

        return { cfnStackNames, cfnTemplates, cfnStacks };
    } catch (error) {
        console.log("##[endgroup]");
        throw new Error(`Failed to get CloudFormation templates: ${error.message}`);
    }
}

/**
 * CloudFormation 上のスタックリソースを取得する
 * @param {string[]} cfnStackNames - Stack 名のリスト
 * @returns {Promise<Record<string, Record<string, object>>>} Stack 名 -> リソース ID -> リソース情報
 */
export async function getCfnStackResources(cfnStackNames) {
    console.log("##[group]Get CloudFormation Stack Resources");

    try {
        const cfnStackResourcesSummaries = {};

        for (const stackName of cfnStackNames) {
            const listStackResources = await $`aws cloudformation list-stack-resources --stack-name ${stackName}`;
            cfnStackResourcesSummaries[stackName] = {};

            for (const resource of JSON.parse(listStackResources.stdout).StackResourceSummaries) {
                cfnStackResourcesSummaries[stackName][resource.LogicalResourceId] = resource;
            }

            console.log(
                `Loaded ${Object.keys(cfnStackResourcesSummaries[stackName]).length} resources for stack: ${stackName}`,
            );
        }

        console.log("##[endgroup]");

        return cfnStackResourcesSummaries;
    } catch (error) {
        console.log("##[endgroup]");
        throw new Error(`Failed to get CloudFormation stack resources: ${error.message}`);
    }
}
