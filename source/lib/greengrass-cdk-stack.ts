import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { GreengrassBaseStack } from './stacks/greengrass-base-stack';
import { GreengrassDeploymentStack } from './stacks/greengrass-deployment-stack';

export interface GreengrassCdkStackProps extends cdk.StackProps {
  bucketNamePrefix: string;
}

export class GreengrassCdkStack extends cdk.Stack {

  greengrassBaseStack: GreengrassBaseStack;
  greengrassDeploymentStack: GreengrassDeploymentStack;

  constructor(scope: Construct, id: string, props: GreengrassCdkStackProps) {
    super(scope, id, props);

    this.greengrassBaseStack = new GreengrassBaseStack(this, `Base`, {
      bucketNamePrefix: props.bucketNamePrefix
    });

    const { bucket, topic, snsPublishRole } = this.greengrassBaseStack;

    this.greengrassDeploymentStack = new GreengrassDeploymentStack(this, `${this.node.tryGetContext("deployment_name")}`, {
      deploymentName: this.node.tryGetContext("deployment_name"),
      bucket,
      topic,
      snsPublishRole
    });
  }
}
