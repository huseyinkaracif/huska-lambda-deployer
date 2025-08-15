import * as vscode from "vscode";
import { AWSCredentialsManager } from "./awsCredentials";
import { LambdaDeployer } from "./lambdaDeployer";
import { NotificationManager } from "./utils/notification";

export function activate(context: vscode.ExtensionContext) {
  console.log("AWS Lambda Deployer extension is now active!");

  const credentialsManager = new AWSCredentialsManager(context);
  const lambdaDeployer = new LambdaDeployer(credentialsManager);

  // Deploy Lambda command
  let deployDisposable = vscode.commands.registerCommand(
    "huska-lambda-deployer.deployLambda",
    async (uri: vscode.Uri) => {
      try {
        // Get the path of the selected file
        const filePath = uri.fsPath;

        // Check AWS credentials
        const hasCredentials = await credentialsManager.checkCredentials();
        if (!hasCredentials) {
          NotificationManager.showError("AWS credentials could not be set!");
          return;
        }

        // Get the Lambda function name
        const functionName = await lambdaDeployer.getFunctionName(filePath);

        // Start the deploy process with progress
        await NotificationManager.showProgress(
          `Deploying Lambda: ${functionName}`,
          async () => {
            const result = await lambdaDeployer.deployLambda(
              filePath,
              functionName
            );

            // Notify the user of the result
            if (result.success) {
              NotificationManager.showSuccess(
                `Lambda successfully deployed: ${functionName}`
              );
            } else {
              NotificationManager.showError(`Deploy error: ${result.error}`);
            }
          }
        );
      } catch (error) {
        NotificationManager.showError(
          `An error occurred during the deploy process: ${error}`
        );
      }
    }
  );

  // Reset credentials command
  let resetCredentialsDisposable = vscode.commands.registerCommand(
    "huska-lambda-deployer.resetCredentials",
    async () => {
      try {
        await credentialsManager.resetCredentials();
      } catch (error) {
        NotificationManager.showError(`Error resetting credentials: ${error}`);
      }
    }
  );

  // Update credentials command
  let updateCredentialsDisposable = vscode.commands.registerCommand(
    "huska-lambda-deployer.updateCredentials",
    async () => {
      try {
        await credentialsManager.updateCredentials();
      } catch (error) {
        NotificationManager.showError(`Error updating credentials: ${error}`);
      }
    }
  );

  // Show credentials command
  let showCredentialsDisposable = vscode.commands.registerCommand(
    "huska-lambda-deployer.showCredentials",
    async () => {
      try {
        await credentialsManager.showCredentials();
      } catch (error) {
        NotificationManager.showError(`Error displaying credentials: ${error}`);
      }
    }
  );

  // Add all commands to context
  context.subscriptions.push(
    deployDisposable,
    resetCredentialsDisposable,
    updateCredentialsDisposable,
    showCredentialsDisposable
  );
}

export function deactivate() {}
