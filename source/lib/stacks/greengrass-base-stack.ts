import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { GreengrassServiceRole } from '../constructs/greengrass-service-role/greengrass-service-role';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cr from 'aws-cdk-lib/custom-resources';
import { readFileSync } from 'fs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import { NagSuppressions } from 'cdk-nag';

export interface GreengrassBaseStackProps extends cdk.NestedStackProps {
    bucketNamePrefix: string;
}

export class GreengrassBaseStack extends cdk.NestedStack {

    bucket: s3.Bucket;
    topic: sns.Topic;
    snsPublishRole: iam.Role;

    constructor(scope: Construct, id: string, props: GreengrassBaseStackProps) {
        super(scope, id, props);

        const greengrassServiceRole = new GreengrassServiceRole(this, 'GreengrassServiceRoleConstruct', {
            account: this.account,
            region: this.region,
            stackName: this.node.tryGetContext("stack_name")
        });

        const removalPolicyString: string = this.node.tryGetContext('bucket_removal_policy');
        let removalPolicy: cdk.RemovalPolicy;
        let autoDeleteObjects: boolean;

        if (removalPolicyString === 'DESTROY') {
            removalPolicy = cdk.RemovalPolicy.DESTROY;
            autoDeleteObjects = true;
        } else {
            removalPolicy = cdk.RemovalPolicy.RETAIN;
            autoDeleteObjects = false;
        }

        this.bucket = new s3.Bucket(this, 'GreengrassBucket', {
            bucketName: `${props.bucketNamePrefix}-${this.account}-${this.region}`,
            removalPolicy: removalPolicy,
            autoDeleteObjects: autoDeleteObjects,
            encryption: s3.BucketEncryption.S3_MANAGED,
            serverAccessLogsPrefix: 's3_server_access_logs/',
            enforceSSL: true,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
        });

        const encryptionKeyPolicy = new iam.PolicyDocument({
            statements: [
                new iam.PolicyStatement({
                    actions: ["kms:*"],
                    resources: ["*"],
                    effect: iam.Effect.ALLOW,
                    principals: [
                        new iam.ArnPrincipal(
                            `arn:aws:iam::${this.account}:root`
                        ),
                    ],
                }),
            ],
        });

        const key = new kms.Key(this, "EncryptionKey", {
            enabled: true,
            enableKeyRotation: true,
            policy: encryptionKeyPolicy,
        });

        this.topic = new sns.Topic(this, 'GreengrassNotificationsTopic', {
            displayName: 'Greengrass Alert Topic',
            masterKey: key
        });

        const resourcePolicyStatement = new iam.PolicyStatement({
            principals: [
                new iam.AnyPrincipal()
            ],
            effect: iam.Effect.DENY,
            actions: ["sns:Publish"],
            resources: [
                this.topic.topicArn,
            ],
            conditions: {
                Bool: { "aws:SecureTransport": "false" },
            },
        });

        this.topic.addToResourcePolicy(resourcePolicyStatement);

        const rule = new events.Rule(this, `GreengrassEventsRule`, {
            eventPattern: {
                detail: {
                    eventSource: ['greengrass.amazonaws.com'],
                    eventName: [
                        'CreateComponentVersion',
                        'CreateDeployment'
                    ]
                }
            }
        });

        rule.addTarget(new targets.SnsTopic(this.topic));

        const iotEventConfiguration = readFileSync(`config/iot-event-configurations.json`, 'utf8');

        const updateEventConfigurationsResource = new cr.AwsCustomResource(this, 'UpdateEventConfigurationsResource', {
            onUpdate: {
                service: '@aws-sdk/client-iot',
                action: 'UpdateEventConfigurationsCommand',
                parameters: {
                    eventConfigurations: JSON.parse(iotEventConfiguration)
                },
                physicalResourceId: cr.PhysicalResourceId.of(Date.now().toString()), // Update physical id to always fetch the latest version
            },
            onDelete: {
                service: '@aws-sdk/client-iot',
                action: 'UpdateEventConfigurationsCommand',
                parameters: {
                    eventConfigurations: JSON.parse(iotEventConfiguration)
                },
                physicalResourceId: cr.PhysicalResourceId.of(Date.now().toString()), // Update physical id to always fetch the latest version
            },
            policy: cr.AwsCustomResourcePolicy.fromStatements([
                new iam.PolicyStatement({
                    actions: ['iot:UpdateEventConfigurations'],
                    resources: ['*']
                })
            ])
        });

        // Suppress resource based findings automatically added by CDK
        NagSuppressions.addResourceSuppressions(
            [updateEventConfigurationsResource],
            [
                {
                    id: 'AwsSolutions-IAM5',
                    reason: 'Default permissions for custom resource construct.',
                }
            ],
            true
        );

        this.snsPublishRole = new iam.Role(this, 'SnsPublishRole', {
            assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),   // required
        });

        this.snsPublishRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: [this.topic.topicArn],
            actions: ['sns:Publish'],
        }));

        // Suppress resource based findings automatically added by CDK
        NagSuppressions.addStackSuppressions(
            this,
            [
                {
                    id: 'AwsSolutions-IAM4',
                    reason: 'Default permissions for custom resource construct.',
                    appliesTo: [
                        'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
                    ]
                }
            ],
            true
        );
    }
}
