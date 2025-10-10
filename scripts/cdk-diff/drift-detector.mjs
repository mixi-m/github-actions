#!/usr/bin/env zx

import { $, sleep } from "zx";

/**
 * Stack の Drift を検知する
 * @param {string[]} stackNames - すべての Stack 名
 * @param {string[]} cfnStackNames - CloudFormation に既に存在する Stack 名
 * @param {number} timeout - タイムアウト時間（ミリ秒）
 * @returns {Promise<boolean>} Drift が検出された場合は true
 */
export async function detectStackDrift(stackNames, cfnStackNames, timeout) {
    console.log("##[group]Detect Stack Drift");

    const driftDetectionStartTime = Date.now();
    let stackDriftDetected = false;
    const driftDetectionRequests = [];

    try {
        // Drift 検知を開始
        for (const stackName of stackNames) {
            if (!cfnStackNames.includes(stackName)) {
                // CFn にまだデプロイされていないスタックはドリフトが存在しない
                console.log(`Stack ${stackName} is not deployed yet, skipping drift detection`);
                continue;
            }

            // Stack Drift Detect を開始
            const command = await $`aws cloudformation detect-stack-drift --stack-name ${stackName}`;
            const res = JSON.parse(command.stdout);
            const driftDetectionId = res.StackDriftDetectionId;
            driftDetectionRequests.push({ stackName, driftDetectionId });
            console.log(`Started drift detection for stack: ${stackName} (ID: ${driftDetectionId})`);
        }

        // ドリフト検知が終わるのを待って結果を取得
        for (const { stackName, driftDetectionId } of driftDetectionRequests) {
            let detectRes;

            while (true) {
                const describeCommand =
                    await $`aws cloudformation describe-stack-drift-detection-status --stack-drift-detection-id ${driftDetectionId}`;
                detectRes = JSON.parse(describeCommand.stdout);

                if (detectRes.DetectionStatus !== "DETECTION_IN_PROGRESS") {
                    break;
                }

                if (Date.now() - driftDetectionStartTime > timeout) {
                    console.log("##[endgroup]");
                    throw new Error("Stack Drift の検知がタイムアウトしました。");
                }

                await sleep(5000);
            }

            console.log(`Drift detection completed for stack: ${stackName}, status: ${detectRes.StackDriftStatus}`);

            if (detectRes.StackDriftStatus === "DRIFTED") {
                stackDriftDetected = true;
            }
        }

        console.log(`Drift detection completed. Drift detected: ${stackDriftDetected}`);
        console.log("##[endgroup]");

        return stackDriftDetected;
    } catch (error) {
        console.log("##[endgroup]");
        throw new Error(`Failed to detect stack drift: ${error.message}`);
    }
}
