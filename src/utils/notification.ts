import * as vscode from "vscode";

export class NotificationManager {
  static showSuccess(message: string): void {
    vscode.window.showInformationMessage(`✅ ${message}`);
  }

  static showError(message: string): void {
    vscode.window.showErrorMessage(`❌ ${message}`);
  }

  static showWarning(message: string): void {
    vscode.window.showWarningMessage(`⚠️ ${message}`);
  }

  static async showProgress(
    title: string,
    task: () => Promise<void>
  ): Promise<void> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: title,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 0 });
        await task();
        progress.report({ increment: 100 });
      }
    );
  }

  static async showConfirmation(message: string): Promise<boolean> {
    const result = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      "Evet",
      "Hayır"
    );
    return result === "Evet";
  }
}
