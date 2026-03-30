from aws_cdk import CfnOutput, RemovalPolicy, Stack
from aws_cdk import aws_dynamodb as dynamodb
from aws_cdk import aws_ssm as ssm
from constructs import Construct


class MenToolStack(Stack):
    """
    Production data layer: DynamoDB single-table (matches scripts/init_db.py) + SSM JWT path.

    Deploy API to Fargate separately (ECR image from backend/Dockerfile): attach task role
    with dynamodb:Put/Get/Query/Update on this table and ssm:GetParameter on the JWT path.
    Frontend: S3 + CloudFront. See infra/README.md.
    """

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        table = dynamodb.Table(
            self,
            "MenToolTable",
            table_name=f"men-tool-{self.stack_name.lower()}",
            partition_key=dynamodb.Attribute(name="pk", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="sk", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.RETAIN,
            point_in_time_recovery_specification=dynamodb.PointInTimeRecoverySpecification(
                point_in_time_recovery_enabled=True
            ),
        )
        table.add_global_secondary_index(
            index_name="gsi_email",
            partition_key=dynamodb.Attribute(name="gsi1_pk", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="gsi1_sk", type=dynamodb.AttributeType.STRING),
            projection_type=dynamodb.ProjectionType.ALL,
        )
        table.add_global_secondary_index(
            index_name="gsi_invite",
            partition_key=dynamodb.Attribute(name="gsi2_pk", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="gsi2_sk", type=dynamodb.AttributeType.STRING),
            projection_type=dynamodb.ProjectionType.ALL,
        )
        table.add_global_secondary_index(
            index_name="gsi_tenant_users",
            partition_key=dynamodb.Attribute(name="gsi3_pk", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="gsi3_sk", type=dynamodb.AttributeType.STRING),
            projection_type=dynamodb.ProjectionType.ALL,
        )
        table.add_global_secondary_index(
            index_name="gsi_followers",
            partition_key=dynamodb.Attribute(name="gsi4_pk", type=dynamodb.AttributeType.STRING),
            sort_key=dynamodb.Attribute(name="gsi4_sk", type=dynamodb.AttributeType.STRING),
            projection_type=dynamodb.ProjectionType.ALL,
        )

        jwt_param = ssm.StringParameter(
            self,
            "JwtSecret",
            parameter_name=f"/men-tool/{construct_id.lower()}/jwt_secret",
            string_value="REPLACE_ME_RUN_AWS_CLI_AFTER_DEPLOY",
            description="JWT HS256 secret — overwrite with SecureString via CLI",
        )

        CfnOutput(self, "TableName", value=table.table_name)
        CfnOutput(self, "TableArn", value=table.table_arn)
        CfnOutput(self, "JwtSsmPath", value=jwt_param.parameter_name)
