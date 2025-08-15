import * as vscode from "vscode";
import { AWSCredentialsManager } from "./awsCredentials";
import { LambdaDeployer } from "./lambdaDeployer";
import { NotificationManager } from "./utils/notification";

export function activate(context: vscode.ExtensionContext) {
  console.log("AWS Lambda Deployer extension is now active!");

  const credentialsManager = new AWSCredentialsManager(context);
  const lambdaDeployer = new LambdaDeployer(credentialsManager);

  // Deploy Lambda komutu
  let deployDisposable = vscode.commands.registerCommand(
    "huska-lambda-deployer.deployLambda",
    async (uri: vscode.Uri) => {
      try {
        // Seçilen dosyanın path'ini al
        const filePath = uri.fsPath;

        // AWS credentials kontrolü
        const hasCredentials = await credentialsManager.checkCredentials();
        if (!hasCredentials) {
          NotificationManager.showError("AWS credentials ayarlanamadı!");
          return;
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

  // Credentials sıfırlama komutu
  let resetCredentialsDisposable = vscode.commands.registerCommand(
    "huska-lambda-deployer.resetCredentials",
    async () => {
      try {
        await credentialsManager.resetCredentials();
      } catch (error) {
        NotificationManager.showError(`Credentials sıfırlama hatası: ${error}`);
      }
    }
  );

  // Credentials güncelleme komutu
  let updateCredentialsDisposable = vscode.commands.registerCommand(
    "huska-lambda-deployer.updateCredentials",
    async () => {
      try {
        await credentialsManager.updateCredentials();
      } catch (error) {
        NotificationManager.showError(
          `Credentials güncelleme hatası: ${error}`
        );
      }
    }
  );

  // Credentials görüntüleme komutu
  let showCredentialsDisposable = vscode.commands.registerCommand(
    "huska-lambda-deployer.showCredentials",
    async () => {
      try {
        await credentialsManager.showCredentials();
      } catch (error) {
        NotificationManager.showError(
          `Credentials görüntüleme hatası: ${error}`
        );
      }
    }
  );

  // Tüm komutları context'e ekle
  context.subscriptions.push(
    deployDisposable,
    resetCredentialsDisposable,
    updateCredentialsDisposable,
    showCredentialsDisposable
  );
}

export function deactivate() {}
