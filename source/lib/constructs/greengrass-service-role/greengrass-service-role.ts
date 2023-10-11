import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export interface GreengrassServiceRoleProps {

}

export class GreengrassServiceRole extends Construct {
    constructor(scope: Construct, id: string, props: GreengrassServiceRoleProps = {}) {
        super(scope, id);

        const nodeFn = new lambda.Function(this, 'GreengrassServiceRoleFunction', {
            code: lambda.Code.fromAsset('lib/constructs/greengrass-service-role/lambda/lookup-greengrass-service-role'),
            handler: 'index.handler',
            runtime: lambda.Runtime.NODEJS_18_X,
            timeout: cdk.Duration.seconds(30),
            environment: {
                'SSM_PARAMETER_NAME': '/Greengrass/Blueprint/GeneratedServiceRoleArn'
            }
        });

        // allow the function to call Greengrass GetServiceRoleForAccount API call
        nodeFn.addToRolePolicy(new iam.PolicyStatement({
            actions: [
                'greengrass:AssociateServiceRoleToAccount',
                'greengrass:DisassociateServiceRoleFromAccount',
                'greengrass:GetServiceRoleForAccount',
                'iam:AttachRolePolicy',
                'iam:CreateRole',
                'iam:DeleteRole',
                'iam:DetachRolePolicy',
                'iam:ListAttachedRolePolicies',
                'iam:PassRole',
                'ssm:DeleteParameter',
                'ssm:GetParameter',
                'ssm:PutParameter'
            ],
            resources: ['*'],
            effect: iam.Effect.ALLOW,
        }));

        const provider = new cr.Provider(this, 'Provider', {
            onEventHandler: nodeFn,
        });

        const resource = new cdk.CustomResource(this, 'Resource', {
            serviceToken: provider.serviceToken,
            properties: props,
        });

    }

}