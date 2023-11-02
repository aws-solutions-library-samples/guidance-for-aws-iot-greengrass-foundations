#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GreengrassCdkStack } from '../lib/greengrass-cdk-stack';
import { AwsSolutionsChecks } from 'cdk-nag'

const app = new cdk.App();

// Add the cdk-nag AwsSolutions Pack with extra verbose logging enabled.
cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))

new GreengrassCdkStack(app, app.node.tryGetContext("stack_name"), {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
  bucketNamePrefix: app.node.tryGetContext("bucket_name_prefix"),
  description: "Guidance for AWS IoT Greengrass Foundations (SO9339)",
});
