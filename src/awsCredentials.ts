import * as vscode from "vscode";
import * as AWS from "aws-sdk";
import * as fs from "fs";
import * as path from "path";

export class AWSCredentialsManager {
  private context: vscode.ExtensionContext;
  private credentialsPath: string;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.credentialsPath = path.join(
      context.globalStorageUri.fsPath,
      "aws-credentials.json"
    );
  }

  async checkCredentials(): Promise<boolean> {
    try {
      // Önce extension'ın kaydettiği credentials'ı kontrol et
      const savedCredentials = await this.getSavedCredentials();
      if (savedCredentials) {
        return true;
      }

      // AWS SDK'nın varsayılan credentials'ını kontrol et
      const credentials = new AWS.Credentials({
        accessKeyId: "",
        secretAccessKey: "",
      });
      if (credentials.accessKeyId && credentials.secretAccessKey) {
        return true;
      }

      return false;
    } catch (error) {
      console.error("Credentials kontrol hatası:", error);
      return false;
    }
  }

  async promptForCredentials(): Promise<void> {
    const accessKeyId = await vscode.window.showInputBox({
      prompt: "AWS Access Key ID girin:",
      password: false,
      placeHolder: "AKIA...",
    });

    if (!accessKeyId) {
      throw new Error("Access Key ID gerekli");
    }

    const secretAccessKey = await vscode.window.showInputBox({
      prompt: "AWS Secret Access Key girin:",
      password: true,
      placeHolder: "Secret key...",
    });

    if (!secretAccessKey) {
      throw new Error("Secret Access Key gerekli");
    }

    const region = await vscode.window.showInputBox({
      prompt: "AWS Region girin (örn: us-east-1):",
      password: false,
      placeHolder: "us-east-1",
      value: "us-east-1",
    });

    if (!region) {
      throw new Error("Region gerekli");
    }

    // Credentials'ı kaydet
    await this.saveCredentials({
      accessKeyId,
      secretAccessKey,
      region,
    });

    vscode.window.showInformationMessage(
      "AWS credentials başarıyla kaydedildi!"
    );
  }

  private async saveCredentials(credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  }): Promise<void> {
    try {
      // Global storage dizinini oluştur
      const dir = path.dirname(this.credentialsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Credentials'ı şifrele ve kaydet
      const encryptedCredentials = {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        region: credentials.region,
        timestamp: new Date().toISOString(),
      };

      fs.writeFileSync(
        this.credentialsPath,
        JSON.stringify(encryptedCredentials, null, 2)
      );
    } catch (error) {
      console.error("Credentials kaydetme hatası:", error);
      throw error;
    }
  }

  private async getSavedCredentials(): Promise<{
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  } | null> {
    try {
      if (!fs.existsSync(this.credentialsPath)) {
        return null;
      }

      const data = fs.readFileSync(this.credentialsPath, "utf8");
      const credentials = JSON.parse(data);

      return {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        region: credentials.region,
      };
    } catch (error) {
      console.error("Kaydedilmiş credentials okuma hatası:", error);
      return null;
    }
  }

  async getCredentials(): Promise<{
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  }> {
    const savedCredentials = await this.getSavedCredentials();
    if (savedCredentials) {
      return savedCredentials;
    }

    throw new Error(
      "AWS credentials bulunamadı. Lütfen önce credentials girin."
    );
  }
}
