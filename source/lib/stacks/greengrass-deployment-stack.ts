import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as greengrassv2 from 'aws-cdk-lib/aws-greengrassv2';
import * as sns from 'aws-cdk-lib/aws-sns';
import { readFileSync } from 'fs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NagSuppressions } from 'cdk-nag';


export interface GreengrassDeploymentStackProps extends cdk.NestedStackProps {
    deploymentName: string;
    bucket: s3.Bucket;
    topic: sns.Topic;
    snsPublishRole: iam.Role;
}

export class GreengrassDeploymentStack extends cdk.NestedStack {
    constructor(scope: Construct, id: string, props: GreengrassDeploymentStackProps) {
        super(scope, id, props);

        const thingGroupName = `${this.node.tryGetContext("thing_group_name_prefix")}-${props.deploymentName}`;

        const iotThingGroup = new iot.CfnThingGroup(this, thingGroupName,
            {
                thingGroupName: thingGroupName
            });

        const deploymentComponents = readFileSync(`config/deployment.components.json`, 'utf8');

        const greengrassDeployment = new greengrassv2.CfnDeployment(this, `GreengrassDeployment-${props.deploymentName}`, {
            targetArn: iotThingGroup.attrArn,
            deploymentName: props.deploymentName,
            deploymentPolicies: {
                componentUpdatePolicy: {
                    action: 'NOTIFY_COMPONENTS',
                    timeoutInSeconds: 60,
                },
                configurationValidationPolicy: {
                    timeoutInSeconds: 30
                },
                failureHandlingPolicy: 'ROLLBACK'
            },
            components: JSON.parse(deploymentComponents)
        });

        // Retaining the deployment resource is required for future updates
        greengrassDeployment.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

        const snsTopicRule = new iot.CfnTopicRule(this, `SnsTopicRule-${props.deploymentName}`, {
            topicRulePayload: {
                actions: [
                    {
                        sns: {
                            targetArn: props.topic.topicArn,
                            roleArn: props.snsPublishRole.roleArn,
                            messageFormat: 'JSON'
                        }
                    }
                ],
                sql: `SELECT * FROM '$aws/events/thingGroupMembership/thingGroup/${thingGroupName}/#'`,
            }
        });

        const tokenExchangeRole = new iam.Role(this, `${thingGroupName}-GreengrassV2TokenExchangeRole`, {
            assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),   // required
        });

        tokenExchangeRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: ['*'],
            actions: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "logs:DescribeLogStreams",
                "s3:GetBucketLocation"
            ],
        }));

        tokenExchangeRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: [`arn:aws:s3:::${props.bucket.bucketName}/*`],
            actions: [
                "s3:GetObject"
            ],
        }));

        // Suppress resource based findings automatically added by CDK
        NagSuppressions.addResourceSuppressions(
            [tokenExchangeRole],
            [
                {
                    id: 'AwsSolutions-IAM5',
                    reason: 'Permissive actions allowed for Greengrass token exchange role.',
                }
            ],
            true
        );

        const cfnRoleAlias = new iot.CfnRoleAlias(this, `${thingGroupName}-GreengrassV2TokenExchangeRoleAlias`, {
            roleArn: tokenExchangeRole.roleArn,
            credentialDurationSeconds: 3600,
            roleAlias: `${thingGroupName}-GreengrassV2TokenExchangeRoleAlias`,
        });

        const policy = new iot.CfnPolicy(
            this,
            'IoTPolicy',
            {
                policyDocument: new iam.PolicyDocument(
                    {
                        statements: [
                            new iam.PolicyStatement(
                                {
                                    actions: ['iot:*'],
                                    resources: ['*'],
                                    effect: iam.Effect.ALLOW
                                }
                            )
                        ]
                    }
                )
            }
        )

        new cdk.CfnOutput(this, 'thing-group-name', { value: thingGroupName });
        new cdk.CfnOutput(this, 'thing-policy-name', { value: policy.policyName || '' });
        new cdk.CfnOutput(this, 'tes-role-name', { value: tokenExchangeRole.roleName });
        new cdk.CfnOutput(this, 'tes-role-alias-name', { value: cfnRoleAlias.roleAlias || '' });
    }
}