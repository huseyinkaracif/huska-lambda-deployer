import * as vscode from "vscode";
import * as AWS from "aws-sdk";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import JSZip from "jszip";
import { AWSCredentialsManager } from "./awsCredentials";
import { AWSCliManager } from "./utils/awsCli";
import { NotificationManager } from "./utils/notification";

const execAsync = promisify(exec);

export class LambdaDeployer {
  private credentialsManager: AWSCredentialsManager;
  private lambda!: AWS.Lambda;
  private awsCliManager: AWSCliManager | null = null;

  constructor(credentialsManager: AWSCredentialsManager) {
    this.credentialsManager = credentialsManager;
  }

  async getFunctionName(filePath: string): Promise<string> {
    // Dosya adından lambda fonksiyon adını tahmin et
    const fileName = path.basename(filePath, path.extname(filePath));
    const suggestedName = fileName.replace(/[^a-zA-Z0-9-_]/g, "-");

    // Kullanıcıdan fonksiyon adını al
    const functionName = await vscode.window.showInputBox({
      prompt: "Lambda fonksiyon adını girin:",
      placeHolder: suggestedName,
      value: suggestedName,
      validateInput: (input) => {
        if (!input || input.trim().length === 0) {
          return "Fonksiyon adı gerekli";
        }
        if (!/^[a-zA-Z0-9-_]+$/.test(input)) {
          return "Fonksiyon adı sadece harf, rakam, tire ve alt çizgi içerebilir";
        }
        return null;
      },
    });

    if (!functionName) {
      throw new Error("Lambda fonksiyon adı gerekli");
    }

    return functionName;
  }

  async deployLambda(
    filePath: string,
    functionName: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // AWS credentials'ı al
      const credentials = await this.credentialsManager.getCredentials();

      // AWS CLI kullanılabilir mi kontrol et
      const awsCliAvailable = await this.checkAWSCliAvailability();

      if (awsCliAvailable) {
        // AWS CLI ile deploy
        return await this.deployWithAWSCli(filePath, functionName, credentials);
      } else {
        // AWS SDK ile deploy (fallback)
        return await this.deployWithSDK(filePath, functionName, credentials);
      }
    } catch (error) {
      console.error("Deploy hatası:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Bilinmeyen hata",
      };
    }
  }

  private async checkAWSCliAvailability(): Promise<boolean> {
    try {
      const { stdout } = await execAsync("aws --version");
      return stdout.includes("aws-cli");
    } catch (error) {
      return false;
    }
  }

  private async deployWithAWSCli(
    filePath: string,
    functionName: string,
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.awsCliManager = new AWSCliManager(credentials);

      // Fonksiyonun var olup olmadığını kontrol et
      const functionExists = await this.awsCliManager.checkFunctionExists(
        functionName
      );

      if (functionExists) {
        // Mevcut fonksiyonu güncelle
        const result = await this.awsCliManager.updateLambdaCode(
          functionName,
          filePath
        );
        return result;
      } else {
        // Yeni fonksiyon oluştur
        const result = await this.awsCliManager.deployLambda(
          filePath,
          functionName
        );
        return result;
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "AWS CLI deploy hatası",
      };
    }
  }

  private async deployWithSDK(
    filePath: string,
    functionName: string,
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // AWS SDK'yı yapılandır
      AWS.config.update({
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        region: credentials.region,
      });

      this.lambda = new AWS.Lambda();

      // Fonksiyonun var olup olmadığını kontrol et
      const functionExists = await this.checkFunctionExists(functionName);

      if (functionExists) {
        // Mevcut fonksiyonu güncelle
        return await this.updateFunction(filePath, functionName);
      } else {
        // Yeni fonksiyon oluştur
        return await this.createFunction(filePath, functionName);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "AWS SDK deploy hatası",
      };
    }
  }

  private async checkFunctionExists(functionName: string): Promise<boolean> {
    try {
      await this.lambda.getFunction({ FunctionName: functionName }).promise();
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("Function not found")
      ) {
        return false;
      }
      throw error;
    }
  }

  private async createFunction(
    filePath: string,
    functionName: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Dosyayı oku ve zip oluştur
      const fileContent = fs.readFileSync(filePath, "utf8");
      const zipBuffer = await this.createZipBuffer(fileContent, filePath);

      // Lambda fonksiyonu oluştur
      const params: AWS.Lambda.CreateFunctionRequest = {
        FunctionName: functionName,
        Runtime: this.getRuntime(filePath),
        Role: await this.getOrCreateExecutionRole(),
        Handler: this.getHandler(filePath),
        Code: {
          ZipFile: zipBuffer,
        },
        Description: `Deployed from VS Code - ${new Date().toISOString()}`,
        Timeout: 30,
        MemorySize: 128,
      };

      await this.lambda.createFunction(params).promise();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Fonksiyon oluşturma hatası",
      };
    }
  }

  private async updateFunction(
    filePath: string,
    functionName: string
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Dosyayı oku ve zip oluştur
      const fileContent = fs.readFileSync(filePath, "utf8");
      const zipBuffer = await this.createZipBuffer(fileContent, filePath);

      // Lambda fonksiyonunu güncelle
      const params: AWS.Lambda.UpdateFunctionCodeRequest = {
        FunctionName: functionName,
        ZipFile: zipBuffer,
      };

      await this.lambda.updateFunctionCode(params).promise();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Fonksiyon güncelleme hatası",
      };
    }
  }

  private async createZipBuffer(
    fileContent: string,
    filePath: string
  ): Promise<Buffer> {
    try {
      const zip = new JSZip();
      const fileName = path.basename(filePath);

      // Dosyayı zip'e ekle
      zip.file(fileName, fileContent);

      // Zip'i buffer olarak oluştur
      const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

      return zipBuffer;
    } catch (error) {
      console.error("Zip oluşturma hatası:", error);
      throw new Error("Zip dosyası oluşturulamadı");
    }
  }

  private getRuntime(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case ".js":
      case ".mjs":
        return "nodejs18.x";
      case ".ts":
        return "nodejs18.x";
      case ".py":
        return "python3.9";
      case ".java":
        return "java11";
      default:
        return "nodejs18.x";
    }
  }

  private getHandler(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath, ext);

    switch (ext) {
      case ".js":
      case ".mjs":
        return `${fileName}.handler`;
      case ".ts":
        return `${fileName}.handler`;
      case ".py":
        return `${fileName}.lambda_handler`;
      case ".java":
        return `com.example.${fileName}::handleRequest`;
      default:
        return `${fileName}.handler`;
    }
  }

  private async getOrCreateExecutionRole(): Promise<string> {
    // Basit bir execution role ARN döndür (gerçek uygulamada role oluşturulabilir)
    const credentials = await this.credentialsManager.getCredentials();
    return `arn:aws:iam::${this.getAccountId()}:role/lambda-execution-role`;
  }

  private async getAccountId(): Promise<string> {
    try {
      const sts = new AWS.STS();
      const data = await sts.getCallerIdentity().promise();
      return data.Account || "123456789012";
    } catch (error) {
      console.error("Account ID alma hatası:", error);
      return "123456789012";
    }
  }
}
