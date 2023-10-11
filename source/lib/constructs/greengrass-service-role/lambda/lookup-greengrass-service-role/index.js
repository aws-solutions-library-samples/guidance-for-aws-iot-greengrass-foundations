"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_greengrassv2_1 = require("@aws-sdk/client-greengrassv2");
const client_ssm_1 = require("@aws-sdk/client-ssm");
const client_iam_1 = require("@aws-sdk/client-iam");
const ggv2 = new client_greengrassv2_1.GreengrassV2({});
const iam = new client_iam_1.IAM({});
const ssm = new client_ssm_1.SSM({});
const handler = async (event, context) => {
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
exports.handler = handler;
async function generateGreengrassServiceRole(ggv2, iam, ssm, accountId, region) {
    await ggv2.getServiceRoleForAccount({}).then(async (data) => {
        console.log(`Greengrass service role already exists: ${data.roleArn}, associated at ${data.associatedAt}.`);
    }).catch(async (err) => {
        console.log(err);
        console.log('Greengrass service role does not exist.');
        let roleInput;
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
}
;
async function deleteGreengrassServiceRole(ggv2, iam, ssm) {
    await ssm.getParameter({
        Name: process.env.SSM_PARAMETER_NAME,
    }).then(async (getParameterOutput) => {
        await ggv2.disassociateServiceRoleFromAccount({
            roleArn: getParameterOutput.Parameter?.Value
        }).then(async (disassociateServiceRoleFromAccountOutput) => {
            await iam.listAttachedRolePolicies({
                RoleName: getParameterOutput.Parameter?.Value?.split('/')[1],
            }).then(async (listAttachedRolePoliciesOutput) => {
                await listAttachedRolePoliciesOutput.AttachedPolicies?.forEach(async (attachedPolicy) => {
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
}
;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSxzRUFBNEQ7QUFDNUQsb0RBQTBDO0FBQzFDLG9EQUFrRTtBQUVsRSxNQUFNLElBQUksR0FBRyxJQUFJLGtDQUFZLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDbEMsTUFBTSxHQUFHLEdBQUcsSUFBSSxnQkFBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3hCLE1BQU0sR0FBRyxHQUFHLElBQUksZ0JBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUdqQixNQUFNLE9BQU8sR0FBRyxLQUFLLEVBQUUsS0FBd0MsRUFBRSxPQUFnQixFQUFFLEVBQUU7SUFFeEYsTUFBTSxTQUFTLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMzRCxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRXhELFFBQVEsS0FBSyxDQUFDLFdBQVcsRUFBRTtRQUN2QixLQUFLLFFBQVEsQ0FBQztRQUNkLEtBQUssUUFBUSxDQUFDLENBQUM7WUFDWCxNQUFNLDZCQUE2QixDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUN2RSxNQUFNO1NBQ1Q7UUFDRCxLQUFLLFFBQVEsQ0FBQyxDQUFDO1lBQ1gsTUFBTSwyQkFBMkIsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ2xELE1BQU07U0FDVDtRQUNELE9BQU8sQ0FBQyxDQUFDO1lBQ0wsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1NBQzNDO0tBQ0o7QUFDTCxDQUFDLENBQUM7QUFuQlcsUUFBQSxPQUFPLFdBbUJsQjtBQUVGLEtB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QyxDQUFDO0lBQ1AsQ0FBQyxDQUFDLENBQUM7QUFFUCxDQUFDO0FBQUEsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENsb3VkRm9ybWF0aW9uQ3VzdG9tUmVzb3VyY2VFdmVudCwgQ29udGV4dCB9IGZyb20gJ2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgR3JlZW5ncmFzc1YyIH0gZnJvbSBcIkBhd3Mtc2RrL2NsaWVudC1ncmVlbmdyYXNzdjJcIjtcbmltcG9ydCB7IFNTTSB9IGZyb20gXCJAYXdzLXNkay9jbGllbnQtc3NtXCI7XG5pbXBvcnQgeyBDcmVhdGVSb2xlQ29tbWFuZElucHV0LCBJQU0gfSBmcm9tIFwiQGF3cy1zZGsvY2xpZW50LWlhbVwiO1xuXG5jb25zdCBnZ3YyID0gbmV3IEdyZWVuZ3Jhc3NWMih7fSk7XG5jb25zdCBpYW0gPSBuZXcgSUFNKHt9KTtcbmNvbnN0IHNzbSA9IG5ldyBTU00oe30pO1xuXG5cbmV4cG9ydCBjb25zdCBoYW5kbGVyID0gYXN5bmMgKGV2ZW50OiBDbG91ZEZvcm1hdGlvbkN1c3RvbVJlc291cmNlRXZlbnQsIGNvbnRleHQ6IENvbnRleHQpID0+IHtcblxuICAgIGNvbnN0IGFjY291bnRJZCA9IGNvbnRleHQuaW52b2tlZEZ1bmN0aW9uQXJuLnNwbGl0KFwiOlwiKVs0XTtcbiAgICBjb25zdCByZWdpb24gPSBjb250ZXh0Lmludm9rZWRGdW5jdGlvbkFybi5zcGxpdChcIjpcIilbM107XG5cbiAgICBzd2l0Y2ggKGV2ZW50LlJlcXVlc3RUeXBlKSB7XG4gICAgICAgIGNhc2UgJ0NyZWF0ZSc6XG4gICAgICAgIGNhc2UgJ1VwZGF0ZSc6IHtcbiAgICAgICAgICAgIGF3YWl0IGdlbmVyYXRlR3JlZW5ncmFzc1NlcnZpY2VSb2xlKGdndjIsIGlhbSwgc3NtLCBhY2NvdW50SWQsIHJlZ2lvbik7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlICdEZWxldGUnOiB7XG4gICAgICAgICAgICBhd2FpdCBkZWxldGVHcmVlbmdyYXNzU2VydmljZVJvbGUoZ2d2MiwgaWFtLCBzc20pO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIHJlcXVlc3QgdHlwZScpO1xuICAgICAgICB9XG4gICAgfVxufTtcblxuYXN5bmMgZnVuY3Rpb24gZ2VuZXJhdGVHcmVlbmdyYXNzU2VydmljZVJvbGUoZ2d2MjogR3JlZW5ncmFzc1YyLCBpYW06IElBTSwgc3NtOiBTU00sIGFjY291bnRJZDogc3RyaW5nLCByZWdpb246IHN0cmluZykge1xuXG4gICAgYXdhaXQgZ2d2Mi5nZXRTZXJ2aWNlUm9sZUZvckFjY291bnQoe30pLnRoZW4oYXN5bmMgKGRhdGEpID0+IHtcblxuICAgICAgICBjb25zb2xlLmxvZyhgR3JlZW5ncmFzcyBzZXJ2aWNlIHJvbGUgYWxyZWFkeSBleGlzdHM6ICR7ZGF0YS5yb2xlQXJufSwgYXNzb2NpYXRlZCBhdCAke2RhdGEuYXNzb2NpYXRlZEF0fS5gKTtcblxuICAgIH0pLmNhdGNoKGFzeW5jIChlcnIpID0+IHtcblxuICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgICBjb25zb2xlLmxvZygnR3JlZW5ncmFzcyBzZXJ2aWNlIHJvbGUgZG9lcyBub3QgZXhpc3QuJyk7XG5cbiAgICAgICAgbGV0IHJvbGVJbnB1dDogQ3JlYXRlUm9sZUNvbW1hbmRJbnB1dDtcblxuICAgICAgICByb2xlSW5wdXQgPSB7XG4gICAgICAgICAgICBSb2xlTmFtZTogYEdyZWVuZ3Jhc3NfU2VydmljZVJvbGUke0RhdGUubm93KCl9YCxcbiAgICAgICAgICAgIEFzc3VtZVJvbGVQb2xpY3lEb2N1bWVudDogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIFZlcnNpb246IFwiMjAxMi0xMC0xN1wiLFxuICAgICAgICAgICAgICAgIFN0YXRlbWVudDogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBFZmZlY3Q6IFwiQWxsb3dcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIFByaW5jaXBhbDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFNlcnZpY2U6IFwiZ3JlZW5ncmFzcy5hbWF6b25hd3MuY29tXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBBY3Rpb246IFwic3RzOkFzc3VtZVJvbGVcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIENvbmRpdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImF3czpTb3VyY2VBY2NvdW50XCI6IGAke2FjY291bnRJZH1gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBBcm5MaWtlOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiYXdzOlNvdXJjZUFyblwiOiBgYXJuOmF3czpncmVlbmdyYXNzOiR7cmVnaW9ufToke2FjY291bnRJZH06KmBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9KVxuICAgICAgICB9O1xuXG4gICAgICAgIGF3YWl0IGlhbS5jcmVhdGVSb2xlKHJvbGVJbnB1dCkudGhlbihhc3luYyAoY3JlYXRlUm9sZU91dHB1dCkgPT4ge1xuXG4gICAgICAgICAgICBhd2FpdCBpYW0uYXR0YWNoUm9sZVBvbGljeSh7XG4gICAgICAgICAgICAgICAgUG9saWN5QXJuOiAnYXJuOmF3czppYW06OmF3czpwb2xpY3kvc2VydmljZS1yb2xlL0FXU0dyZWVuZ3Jhc3NSZXNvdXJjZUFjY2Vzc1JvbGVQb2xpY3knLFxuICAgICAgICAgICAgICAgIFJvbGVOYW1lOiBjcmVhdGVSb2xlT3V0cHV0LlJvbGU/LlJvbGVOYW1lLFxuICAgICAgICAgICAgfSkudGhlbihhc3luYyAoYXR0YWNoUm9sZVBvbGljeU91dHB1dCkgPT4ge1xuXG4gICAgICAgICAgICAgICAgYXdhaXQgZ2d2Mi5hc3NvY2lhdGVTZXJ2aWNlUm9sZVRvQWNjb3VudCh7XG4gICAgICAgICAgICAgICAgICAgIHJvbGVBcm46IGNyZWF0ZVJvbGVPdXRwdXQuUm9sZT8uQXJuLFxuICAgICAgICAgICAgICAgIH0pLnRoZW4oYXN5bmMgKGFzc29jaWF0ZVNlcnZpY2VSb2xlVG9BY2NvdW50T3V0cHV0KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdBc3NvY2lhdGVkIHJvbGUgc3VjY2Vzc2Z1bGx5IScpO1xuXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHNzbS5wdXRQYXJhbWV0ZXIoe1xuICAgICAgICAgICAgICAgICAgICAgICAgTmFtZTogcHJvY2Vzcy5lbnYuU1NNX1BBUkFNRVRFUl9OQU1FLFxuICAgICAgICAgICAgICAgICAgICAgICAgVmFsdWU6IGNyZWF0ZVJvbGVPdXRwdXQuUm9sZT8uQXJuLFxuICAgICAgICAgICAgICAgICAgICAgICAgVHlwZTogJ1N0cmluZycsXG4gICAgICAgICAgICAgICAgICAgICAgICBPdmVyd3JpdGU6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0pLmNhdGNoKGFzeW5jIChlcnIpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXJyKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH0pO1xuXG4gICAgfSk7XG5cbn07XG5cbmFzeW5jIGZ1bmN0aW9uIGRlbGV0ZUdyZWVuZ3Jhc3NTZXJ2aWNlUm9sZShnZ3YyOiBHcmVlbmdyYXNzVjIsIGlhbTogSUFNLCBzc206IFNTTSkge1xuXG4gICAgYXdhaXQgc3NtLmdldFBhcmFtZXRlcih7XG4gICAgICAgIE5hbWU6IHByb2Nlc3MuZW52LlNTTV9QQVJBTUVURVJfTkFNRSxcbiAgICB9KS50aGVuKGFzeW5jIChnZXRQYXJhbWV0ZXJPdXRwdXQpID0+IHtcblxuICAgICAgICBhd2FpdCBnZ3YyLmRpc2Fzc29jaWF0ZVNlcnZpY2VSb2xlRnJvbUFjY291bnQoe1xuICAgICAgICAgICAgcm9sZUFybjogZ2V0UGFyYW1ldGVyT3V0cHV0LlBhcmFtZXRlcj8uVmFsdWVcbiAgICAgICAgfSkudGhlbihhc3luYyAoZGlzYXNzb2NpYXRlU2VydmljZVJvbGVGcm9tQWNjb3VudE91dHB1dCkgPT4ge1xuXG4gICAgICAgICAgICBhd2FpdCBpYW0ubGlzdEF0dGFjaGVkUm9sZVBvbGljaWVzKHtcbiAgICAgICAgICAgICAgICBSb2xlTmFtZTogZ2V0UGFyYW1ldGVyT3V0cHV0LlBhcmFtZXRlcj8uVmFsdWU/LnNwbGl0KCcvJylbMV0sXG4gICAgICAgICAgICB9KS50aGVuKGFzeW5jIChsaXN0QXR0YWNoZWRSb2xlUG9saWNpZXNPdXRwdXQpID0+IHtcblxuICAgICAgICAgICAgICAgIGF3YWl0IGxpc3RBdHRhY2hlZFJvbGVQb2xpY2llc091dHB1dC5BdHRhY2hlZFBvbGljaWVzPy5mb3JFYWNoKGFzeW5jIGF0dGFjaGVkUG9saWN5ID0+IHtcblxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBpYW0uZGV0YWNoUm9sZVBvbGljeSh7XG4gICAgICAgICAgICAgICAgICAgICAgICBQb2xpY3lBcm46IGF0dGFjaGVkUG9saWN5LlBvbGljeUFybixcbiAgICAgICAgICAgICAgICAgICAgICAgIFJvbGVOYW1lOiBnZXRQYXJhbWV0ZXJPdXRwdXQuUGFyYW1ldGVyPy5WYWx1ZT8uc3BsaXQoJy8nKVsxXSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgIGF3YWl0IGlhbS5kZWxldGVSb2xlKHtcbiAgICAgICAgICAgICAgICAgICAgUm9sZU5hbWU6IGdldFBhcmFtZXRlck91dHB1dC5QYXJhbWV0ZXI/LlZhbHVlPy5zcGxpdCgnLycpWzFdLFxuICAgICAgICAgICAgICAgIH0pLnRoZW4oYXN5bmMgKGRlbGV0ZVJvbGVPdXRwdXQpID0+IHtcblxuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnRGVsZXRlZCByb2xlIHN1Y2Nlc3NmdWxseSEnKTtcblxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBzc20uZGVsZXRlUGFyYW1ldGVyKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIE5hbWU6IHByb2Nlc3MuZW52LlNTTV9QQVJBTUVURVJfTkFNRSxcbiAgICAgICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuXG59O1xuXG5cbiJdfQ==