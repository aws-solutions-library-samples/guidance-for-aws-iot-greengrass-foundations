#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GreengrassCdkStack } from '../lib/greengrass-cdk-stack';

(() => {
  const app = new cdk.App();

  new GreengrassCdkStack(app, app.node.tryGetContext("stack_name"), {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
    bucketNamePrefix: app.node.tryGetContext("bucket_name_prefix")
  });

  app.synth();
})();