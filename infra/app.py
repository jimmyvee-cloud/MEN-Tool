#!/usr/bin/env python3
import os

import aws_cdk as cdk

from mentool_stack.stack import MenToolStack

app = cdk.App()
MenToolStack(
    app,
    "MenToolStack",
    env=cdk.Environment(
        account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
        region=os.environ.get("CDK_DEFAULT_REGION", "us-east-1"),
    ),
)
app.synth()
