import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NagSuppressions } from 'cdk-nag';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface GreengrassServiceRoleProps {
    region: string;
    account: string;
    stackName: string;
}

export class GreengrassServiceRole extends Construct {
    constructor(scope: Construct, id: string, props: GreengrassServiceRoleProps) {
        super(scope, id);

        const greengrassServiceRoleFunctionRole = new iam.Role(this, "GreengrassServiceRoleFunctionRole", {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            path: "/",
        });

        const ssm_parameter_name = `/GreengrassFoundations/${props.stackName}/GeneratedServiceRoleArn`;

        const greengrassServiceRoleFunction = new NodejsFunction(this, 'GreengrassServiceRoleFunction', {
            entry: 'lib/constructs/greengrass-service-role/lambda/lookup-greengrass-service-role/index.ts',
            handler: 'index.handler',
            runtime: lambda.Runtime.NODEJS_18_X,
            timeout: cdk.Duration.seconds(30),
            environment: {
                'SSM_PARAMETER_NAME': ssm_parameter_name
            },
            role: greengrassServiceRoleFunctionRole
        });

        const greengrassServiceRoleFunctionLogGroup = new logs.LogGroup(this, 'GreengrassServiceRoleFunctionLogGroup', {
            logGroupName: `/aws/lambda/${greengrassServiceRoleFunction.functionName}`,
        });

        const greengrassServiceRoleFunctionRolePolicy = new iam.Policy(this, "GreengrassServiceRoleFunctionRolePolicy", {
            statements: [
                new iam.PolicyStatement({
                    actions: ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
                    resources: [
                        greengrassServiceRoleFunctionLogGroup.logGroupArn
                    ],
                }),
                new iam.PolicyStatement({
                    actions: [
                        'greengrass:AssociateServiceRoleToAccount',
                        'greengrass:DisassociateServiceRoleFromAccount',
                        'greengrass:GetServiceRoleForAccount',
                    ],
                    resources: ['*'],
                    effect: iam.Effect.ALLOW,
                }),
                new iam.PolicyStatement({
                    actions: [
                        'iam:PassRole',
                        'iam:AttachRolePolicy',
                        'iam:CreateRole',
                        'iam:DeleteRole',
                        'iam:DetachRolePolicy',
                        'iam:ListAttachedRolePolicies',
                    ],
                    resources: [`arn:aws:iam::${props.account}:role/GreengrassFoundations_ServiceRole-${props.region}`],
                    effect: iam.Effect.ALLOW,
                }),
                new iam.PolicyStatement({
                    actions: [
                        'ssm:DeleteParameter',
                        'ssm:GetParameter',
                        'ssm:PutParameter'
                    ],
                    resources: [`arn:aws:ssm:${props.region}:${props.account}:parameter${ssm_parameter_name}`],
                    effect: iam.Effect.ALLOW,
                })
            ],
        });

        greengrassServiceRoleFunctionRolePolicy.attachToRole(greengrassServiceRoleFunctionRole);

        const provider = new cr.Provider(this, 'Provider', {
            onEventHandler: greengrassServiceRoleFunction,
        });

        const resource = new cdk.CustomResource(this, 'Resource', {
            serviceToken: provider.serviceToken,
            properties: props,
        });

        // Suppress resource based findings automatically added by CDK
        NagSuppressions.addResourceSuppressions(
            provider,
            [
                {
                    id: 'AwsSolutions-IAM4',
                    reason: 'Default role for Custom Resource provider construct',
                },
                {
                    id: 'AwsSolutions-IAM5',
                    reason: 'Default role for Custom Resource provider construct',
                }
            ],
            true
        );

        // Suppress resource based findings automatically added by CDK
        NagSuppressions.addResourceSuppressions(
            greengrassServiceRoleFunctionRolePolicy,
            [
                {
                    id: 'AwsSolutions-IAM5',
                    reason: 'For Greengrass service role actions',
                }
            ],
            true
        );

    }

}