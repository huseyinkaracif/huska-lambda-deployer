import { exec } from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import JSZip from "jszip";
import { NotificationManager } from "./notification";

const execAsync = promisify(exec);

export class AWSCliManager {
  private credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  };

  constructor(credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  }) {
    this.credentials = credentials;
  }

  async deployLambda(
    filePath: string,
    functionName: string
  ): Promise<{
    success: boolean;
    error?: string;
    output?: string;
  }> {
    let zipPath: string | null = null;

    try {
      // Önce zip dosyası oluştur
      zipPath = await this.createZipFile(filePath);

      // AWS CLI ile deploy işlemi
      const command = this.buildDeployCommand(zipPath, functionName);

      const { stdout, stderr } = await execAsync(command, {
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: this.credentials.accessKeyId,
          AWS_SECRET_ACCESS_KEY: this.credentials.secretAccessKey,
          AWS_DEFAULT_REGION: this.credentials.region,
        },
      });

      if (stderr && !stderr.includes("warning")) {
        return {
          success: false,
          error: stderr,
        };
      }

      return {
        success: true,
        output: stdout,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Bilinmeyen hata",
      };
    } finally {
      // Her durumda geçici zip dosyasını temizle
      if (zipPath) {
        this.cleanupTempFile(zipPath);
      }
    }
  }

  private async createZipFile(filePath: string): Promise<string> {
    try {
      const zip = new JSZip();
      const fileName = path.basename(filePath);
      const fileContent = fs.readFileSync(filePath, "utf8");

      // Dosyayı zip'e ekle
      zip.file(fileName, fileContent);

      // Geçici zip dosyası oluştur
      const tempZipPath = path.join(path.dirname(filePath), `${fileName}.zip`);
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

      fs.writeFileSync(tempZipPath, zipBuffer);

      return tempZipPath;
    } catch (error) {
      throw new Error(`Zip dosyası oluşturulamadı: ${error}`);
    }
  }

  private cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Geçici zip dosyası silindi: ${filePath}`);
        NotificationManager.showInfo("Geçici dosyalar temizlendi");
      }
    } catch (error) {
      console.error("Geçici dosya temizleme hatası:", error);
      NotificationManager.showWarning("Geçici dosya temizlenirken hata oluştu");
    }
  }

  private buildDeployCommand(filePath: string, functionName: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase();

    switch (ext) {
      case "js":
      case "mjs":
      case "ts":
        return `aws lambda create-function --function-name ${functionName} --runtime nodejs18.x --role arn:aws:iam::${this.getAccountId()}:role/lambda-execution-role --handler ${this.getHandler(
          filePath
        )} --zip-file fileb://${filePath} --region ${this.credentials.region}`;

      case "py":
        return `aws lambda create-function --function-name ${functionName} --runtime python3.9 --role arn:aws:iam::${this.getAccountId()}:role/lambda-execution-role --handler ${this.getHandler(
          filePath
        )} --zip-file fileb://${filePath} --region ${this.credentials.region}`;

      case "java":
        return `aws lambda create-function --function-name ${functionName} --runtime java11 --role arn:aws:iam::${this.getAccountId()}:role/lambda-execution-role --handler ${this.getHandler(
          filePath
        )} --zip-file fileb://${filePath} --region ${this.credentials.region}`;

      default:
        return `aws lambda create-function --function-name ${functionName} --runtime nodejs18.x --role arn:aws:iam::${this.getAccountId()}:role/lambda-execution-role --handler ${this.getHandler(
          filePath
        )} --zip-file fileb://${filePath} --region ${this.credentials.region}`;
    }
  }

  private getHandler(filePath: string): string {
    const fileName = filePath.split("/").pop()?.split(".")[0];
    const ext = filePath.split(".").pop()?.toLowerCase();

    switch (ext) {
      case "js":
      case "mjs":
      case "ts":
        return `${fileName}.handler`;
      case "py":
        return `${fileName}.lambda_handler`;
      case "java":
        return `com.example.${fileName}::handleRequest`;
      default:
        return `${fileName}.handler`;
    }
  }

  private getAccountId(): string {
    // Basit account ID döndür (gerçek uygulamada AWS STS ile alınabilir)
    return "123456789012";
  }

  async checkAWSCliInstalled(): Promise<boolean> {
    try {
      await execAsync("aws --version");
      return true;
    } catch (error) {
      return false;
    }
  }

  async updateLambdaCode(
    functionName: string,
    filePath: string
  ): Promise<{
    success: boolean;
    error?: string;
    output?: string;
  }> {
    let zipPath: string | null = null;

    try {
      // Önce zip dosyası oluştur
      zipPath = await this.createZipFile(filePath);

      const command = `aws lambda update-function-code --function-name ${functionName} --zip-file fileb://${zipPath} --region ${this.credentials.region}`;

      const { stdout, stderr } = await execAsync(command, {
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: this.credentials.accessKeyId,
          AWS_SECRET_ACCESS_KEY: this.credentials.secretAccessKey,
          AWS_DEFAULT_REGION: this.credentials.region,
        },
      });

      if (stderr && !stderr.includes("warning")) {
        return {
          success: false,
          error: stderr,
        };
      }

      return {
        success: true,
        output: stdout,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Bilinmeyen hata",
      };
    } finally {
      // Her durumda geçici zip dosyasını temizle
      if (zipPath) {
        this.cleanupTempFile(zipPath);
      }
    }
  }

  async checkFunctionExists(functionName: string): Promise<boolean> {
    try {
      const command = `aws lambda get-function --function-name ${functionName} --region ${this.credentials.region}`;

      await execAsync(command, {
        env: {
          ...process.env,
          AWS_ACCESS_KEY_ID: this.credentials.accessKeyId,
          AWS_SECRET_ACCESS_KEY: this.credentials.secretAccessKey,
          AWS_DEFAULT_REGION: this.credentials.region,
        },
      });

      return true;
    } catch (error) {
      return false;
    }
  }
}
