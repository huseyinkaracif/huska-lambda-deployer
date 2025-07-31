import * as vscode from "vscode";
import { AWSCredentialsManager } from "./awsCredentials";
import { LambdaDeployer } from "./lambdaDeployer";
import { NotificationManager } from "./utils/notification";

export function activate(context: vscode.ExtensionContext) {
  console.log("AWS Lambda Deployer extension is now active!");

  const credentialsManager = new AWSCredentialsManager(context);
  const lambdaDeployer = new LambdaDeployer(credentialsManager);

  let disposable = vscode.commands.registerCommand(
    "obidev-lambda-deployer.deployLambda",
    async (uri: vscode.Uri) => {
      try {
        // Seçilen dosyanın path'ini al
        const filePath = uri.fsPath;

        // AWS credentials kontrolü
        const hasCredentials = await credentialsManager.checkCredentials();
        if (!hasCredentials) {
          await credentialsManager.promptForCredentials();
        }

        // Lambda fonksiyon adını al
        const functionName = await lambdaDeployer.getFunctionName(filePath);

        // Progress ile deploy işlemini başlat
        await NotificationManager.showProgress(
          `Lambda deploy ediliyor: ${functionName}`,
          async () => {
            const result = await lambdaDeployer.deployLambda(
              filePath,
              functionName
            );

            // Sonucu kullanıcıya bildir
            if (result.success) {
              NotificationManager.showSuccess(
                `Lambda başarıyla deploy edildi: ${functionName}`
              );
            } else {
              NotificationManager.showError(`Deploy hatası: ${result.error}`);
            }
          }
        );
      } catch (error) {
        NotificationManager.showError(
          `Deploy işlemi sırasında hata oluştu: ${error}`
        );
      }
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
