import * as vscode from "vscode";
import * as AWS from "aws-sdk";
import * as fs from "fs";
import * as path from "path";
import { NotificationManager } from "./utils/notification";

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
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        // Kullanıcıya bilgi ver
        NotificationManager.showInfo(
          "AWS Credentials girişi başlıyor. Her alanı dikkatli doldurun."
        );

        // Access Key ID
        const accessKeyId = await vscode.window.showInputBox({
          prompt: "AWS Access Key ID girin:",
          password: false,
          placeHolder: "AKIA...",
          ignoreFocusOut: true, // Input alanının kaybolmasını engelle
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return "Access Key ID boş olamaz";
            }
            if (!value.startsWith("AKIA")) {
              return "Access Key ID 'AKIA' ile başlamalıdır";
            }
            return null;
          },
        });

        if (!accessKeyId) {
          throw new Error("Access Key ID gerekli");
        }

        // Kısa bir bekleme süresi ekle
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Secret Access Key
        const secretAccessKey = await vscode.window.showInputBox({
          prompt: "AWS Secret Access Key girin:",
          password: true,
          placeHolder: "Secret key...",
          ignoreFocusOut: true, // Input alanının kaybolmasını engelle
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return "Secret Access Key boş olamaz";
            }
            if (value.length < 20) {
              return "Secret Access Key çok kısa";
            }
            return null;
          },
        });

        if (!secretAccessKey) {
          throw new Error("Secret Access Key gerekli");
        }

        // Kısa bir bekleme süresi ekle
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Region
        const region = await vscode.window.showInputBox({
          prompt: "AWS Region girin (örn: us-east-1):",
          password: false,
          placeHolder: "us-east-1",
          value: "us-east-1",
          ignoreFocusOut: true, // Input alanının kaybolmasını engelle
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return "Region boş olamaz";
            }
            const validRegions = [
              "us-east-1",
              "us-east-2",
              "us-west-1",
              "us-west-2",
              "eu-west-1",
              "eu-central-1",
              "ap-southeast-1",
              "ap-southeast-2",
            ];
            if (!validRegions.includes(value)) {
              return "Geçerli bir AWS region girin";
            }
            return null;
          },
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

        NotificationManager.showSuccess(
          "AWS credentials başarıyla kaydedildi!"
        );

        // Başarılı olursa döngüden çık
        break;
      } catch (error) {
        retryCount++;

        if (retryCount >= maxRetries) {
          NotificationManager.showError(
            `Credentials girişi başarısız oldu. Lütfen tekrar deneyin. Hata: ${error}`
          );
          throw error;
        }

        const retry = await NotificationManager.showConfirmation(
          `Credentials girişi sırasında hata oluştu. Tekrar denemek ister misiniz? (${retryCount}/${maxRetries})`
        );

        if (!retry) {
          throw new Error("Kullanıcı tarafından iptal edildi");
        }

        // Kısa bir bekleme süresi
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
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
