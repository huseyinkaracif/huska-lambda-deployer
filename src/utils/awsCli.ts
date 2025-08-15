import { exec } from "child_process";
import { promisify } from "util";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
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

  // Static metodlar - credentials olmadan kullanılabilir
  static async getAwsProfiles(): Promise<string[]> {
    try {
      const credentialsPath = path.join(os.homedir(), '.aws', 'credentials');
      const configPath = path.join(os.homedir(), '.aws', 'config');
      
      const profiles = new Set<string>();

      // credentials dosyasından profilleri oku
      if (fs.existsSync(credentialsPath)) {
        const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
        const credentialProfiles = this.parseAwsConfigProfiles(credentialsContent);
        credentialProfiles.forEach(profile => profiles.add(profile));
      }

      // config dosyasından profilleri oku
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const configProfiles = this.parseAwsConfigProfiles(configContent, true);
        configProfiles.forEach(profile => profiles.add(profile));
      }

      return Array.from(profiles).sort();
    } catch (error) {
      console.error('AWS profilleri okunamadı:', error);
      return [];
    }
  }

  static async checkAwsCredentialsExist(): Promise<boolean> {
    try {
      const credentialsPath = path.join(os.homedir(), '.aws', 'credentials');
      const configPath = path.join(os.homedir(), '.aws', 'config');
      
      return fs.existsSync(credentialsPath) || fs.existsSync(configPath);
    } catch (error) {
      return false;
    }
  }

  static async getProfileCredentials(profileName: string): Promise<{
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  } | null> {
    try {
      const credentialsPath = path.join(os.homedir(), '.aws', 'credentials');
      const configPath = path.join(os.homedir(), '.aws', 'config');
      
      let accessKeyId = '';
      let secretAccessKey = '';
      let region = 'us-east-1'; // default region

      // credentials dosyasından access key ve secret key'i al
      if (fs.existsSync(credentialsPath)) {
        const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
        const credentials = this.parseAwsCredentials(credentialsContent, profileName);
        if (credentials) {
          accessKeyId = credentials.aws_access_key_id || '';
          secretAccessKey = credentials.aws_secret_access_key || '';
        }
      }

      // config dosyasından region'ı al
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const configData = this.parseAwsCredentials(configContent, profileName, true);
        if (configData && configData.region) {
          region = configData.region;
        }
      }

      if (accessKeyId && secretAccessKey) {
        return {
          accessKeyId,
          secretAccessKey,
          region
        };
      }

      return null;
    } catch (error) {
      console.error(`Profil ${profileName} için credentials okunamadı:`, error);
      return null;
    }
  }

  private static parseAwsConfigProfiles(content: string, isConfig = false): string[] {
    const profiles: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        let profileName = trimmed.slice(1, -1);
        
        // config dosyasında profiller 'profile ' prefix'i ile başlar (default hariç)
        if (isConfig && profileName.startsWith('profile ')) {
          profileName = profileName.replace('profile ', '');
        }
        
        profiles.push(profileName);
      }
    }
    
    return profiles;
  }

  private static parseAwsCredentials(content: string, profileName: string, isConfig = false): any {
    const lines = content.split('\n');
    let currentProfile = '';
    let inTargetProfile = false;
    const credentials: any = {};
    
    const targetProfileName = isConfig && profileName !== 'default' ? `profile ${profileName}` : profileName;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentProfile = trimmed.slice(1, -1);
        inTargetProfile = currentProfile === targetProfileName;
        continue;
      }
      
      if (inTargetProfile && trimmed.includes('=')) {
        const [key, value] = trimmed.split('=').map(s => s.trim());
        credentials[key] = value;
      }
    }
    
    return Object.keys(credentials).length > 0 ? credentials : null;
  }
}
