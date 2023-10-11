import { CloudFormationCustomResourceEvent, Context } from 'aws-lambda';
import { GreengrassV2 } from "@aws-sdk/client-greengrassv2";
import { SSM } from "@aws-sdk/client-ssm";
import { CreateRoleCommandInput, IAM } from "@aws-sdk/client-iam";

const ggv2 = new GreengrassV2({});
const iam = new IAM({});
const ssm = new SSM({});


export const handler = async (event: CloudFormationCustomResourceEvent, context: Context) => {

    const accountId = context.invokedFunctionArn.split(":")[4];
    const region = context.invokedFunctionArn.split(":")[3];

    switch (event.RequestType) {
        case 'Create':
        case 'Update': {
            await generateGreengrassServiceRole(ggv2, iam, ssm, accountId, region);
            break;
        }
        case 'Delete': {
            await deleteGreengrassServiceRole(ggv2, iam, ssm);
            break;
        }
        default: {
            throw new Error('Unknown request type');
        }
    }
};

async function generateGreengrassServiceRole(ggv2: GreengrassV2, iam: IAM, ssm: SSM, accountId: string, region: string) {

    await ggv2.getServiceRoleForAccount({}).then(async (data) => {

        console.log(`Greengrass service role already exists: ${data.roleArn}, associated at ${data.associatedAt}.`);

    }).catch(async (err) => {

        console.log(err);
        console.log('Greengrass service role does not exist.');

        let roleInput: CreateRoleCommandInput;

        roleInput = {
            RoleName: `Greengrass_ServiceRole${Date.now()}`,
            AssumeRolePolicyDocument: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Principal: {
                            Service: "greengrass.amazonaws.com"
                        },
                        Action: "sts:AssumeRole",
                        Condition: {
                            StringEquals: {
                                "aws:SourceAccount": `${accountId}`
                            },
                            ArnLike: {
                                "aws:SourceArn": `arn:aws:greengrass:${region}:${accountId}:*`
                            }
                        }
                    }
                ]
            })
        };

        await iam.createRole(roleInput).then(async (createRoleOutput) => {

            await iam.attachRolePolicy({
                PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSGreengrassResourceAccessRolePolicy',
                RoleName: createRoleOutput.Role?.RoleName,
            }).then(async (attachRolePolicyOutput) => {

                await ggv2.associateServiceRoleToAccount({
                    roleArn: createRoleOutput.Role?.Arn,
                }).then(async (associateServiceRoleToAccountOutput) => {
                    console.log('Associated role successfully!');

                    await ssm.putParameter({
                        Name: process.env.SSM_PARAMETER_NAME,
                        Value: createRoleOutput.Role?.Arn,
                        Type: 'String',
                        Overwrite: true,
                    });
                }).catch(async (err) => {
                    console.log(err);
                });
            });

        });

    });

};

async function deleteGreengrassServiceRole(ggv2: GreengrassV2, iam: IAM, ssm: SSM) {

    await ssm.getParameter({
        Name: process.env.SSM_PARAMETER_NAME,
    }).then(async (getParameterOutput) => {

        await ggv2.disassociateServiceRoleFromAccount({
            roleArn: getParameterOutput.Parameter?.Value
        }).then(async (disassociateServiceRoleFromAccountOutput) => {

            await iam.listAttachedRolePolicies({
                RoleName: getParameterOutput.Parameter?.Value?.split('/')[1],
            }).then(async (listAttachedRolePoliciesOutput) => {

                await listAttachedRolePoliciesOutput.AttachedPolicies?.forEach(async attachedPolicy => {

                    await iam.detachRolePolicy({
                        PolicyArn: attachedPolicy.PolicyArn,
                        RoleName: getParameterOutput.Parameter?.Value?.split('/')[1],
                    });

                });

                await iam.deleteRole({
                    RoleName: getParameterOutput.Parameter?.Value?.split('/')[1],
                }).then(async (deleteRoleOutput) => {

                    console.log('Deleted role successfully!');

                    await ssm.deleteParameter({
                        Name: process.env.SSM_PARAMETER_NAME,
                    });

                });

            });
        });
    });

};


