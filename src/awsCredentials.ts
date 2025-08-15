import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { NotificationManager } from "./utils/notification";
import { AWSCliManager } from "./utils/awsCli";

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
      // First, check the credentials saved by the extension
      const savedCredentials = await this.getSavedCredentials();
      if (savedCredentials) {
        return true;
      }

      // Check if there are AWS profiles
      const hasAwsProfiles = await AWSCliManager.checkAwsCredentialsExist();
      if (hasAwsProfiles) {
        return await this.showProfileSelectionMenu();
      }

      // Return false if no credentials are found
      return false;
    } catch (error) {
      console.error("Error checking credentials:", error);
      return false;
    }
  }

  async showProfileSelectionMenu(): Promise<boolean> {
    try {
      const profiles = await AWSCliManager.getAwsProfiles();

      if (profiles.length === 0) {
        return false;
      }

      // Prepare menu options
      const menuItems: vscode.QuickPickItem[] = [
        {
          label: "$(plus) Enter New Credentials",
          description: "Enter new AWS credentials",
          detail: "You will manually enter new AWS credentials",
        },
      ];

      // Add existing profiles
      profiles.forEach((profile) => {
        menuItems.push({
          label: `$(account) ${profile}`,
          description: `AWS profile: ${profile}`,
          detail: `Use the saved ${profile} profile`,
        });
      });

      const selectedItem = await vscode.window.showQuickPick(menuItems, {
        placeHolder: "Select AWS Credentials",
        title: "AWS Profile Selection",
        ignoreFocusOut: true,
      });

      if (!selectedItem) {
        return false;
      }

      // If "Enter New Credentials" is selected
      if (selectedItem.label.includes("Enter New Credentials")) {
        await this.promptForCredentials();
        return true;
      }

      // If an existing profile is selected
      const profileName = selectedItem.label.replace("$(account) ", "");
      const profileCredentials = await AWSCliManager.getProfileCredentials(
        profileName
      );

      if (profileCredentials) {
        // Save the profile credentials in the extension's format
        await this.saveCredentials({
          accessKeyId: profileCredentials.accessKeyId,
          secretAccessKey: profileCredentials.secretAccessKey,
          region: profileCredentials.region,
        });

        NotificationManager.showSuccess(
          `AWS profile successfully loaded: ${profileName}`
        );
        return true;
      } else {
        NotificationManager.showError(
          `Valid credentials not found for profile ${profileName}!`
        );
        return false;
      }
    } catch (error) {
      console.error("Error in profile selection menu:", error);
      NotificationManager.showError(`Profile selection error: ${error}`);
      return false;
    }
  }

  async promptForCredentials(): Promise<void> {
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        // Inform the user
        NotificationManager.showInfo(
          "Starting AWS Credentials entry. Please fill in each field carefully."
        );

        // Access Key ID
        const accessKeyId = await vscode.window.showInputBox({
          prompt: "Enter AWS Access Key ID:",
          password: false,
          placeHolder: "AKIA...",
          ignoreFocusOut: true, // Prevent the input box from disappearing
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return "Access Key ID cannot be empty";
            }
            if (!value.startsWith("AKIA")) {
              return "Access Key ID must start with 'AKIA'";
            }
            return null;
          },
        });

        if (!accessKeyId) {
          throw new Error("Access Key ID is required");
        }

        // Add a short delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Secret Access Key
        const secretAccessKey = await vscode.window.showInputBox({
          prompt: "Enter AWS Secret Access Key:",
          password: true,
          placeHolder: "Secret key...",
          ignoreFocusOut: true, // Prevent the input box from disappearing
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return "Secret Access Key cannot be empty";
            }
            if (value.length < 20) {
              return "Secret Access Key is too short";
            }
            return null;
          },
        });

        if (!secretAccessKey) {
          throw new Error("Secret Access Key is required");
        }

        // Add a short delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Region
        const region = await vscode.window.showInputBox({
          prompt: "Enter AWS Region (e.g., us-east-1):",
          password: false,
          placeHolder: "us-east-1",
          value: "us-east-1",
          ignoreFocusOut: true, // Prevent the input box from disappearing
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return "Region cannot be empty";
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
              return "Enter a valid AWS region";
            }
            return null;
          },
        });

        if (!region) {
          throw new Error("Region is required");
        }

        // Save the credentials
        await this.saveCredentials({
          accessKeyId,
          secretAccessKey,
          region,
        });

        NotificationManager.showSuccess("AWS credentials successfully saved!");

        // Exit the loop if successful
        break;
      } catch (error) {
        retryCount++;

        if (retryCount >= maxRetries) {
          NotificationManager.showError(
            `Credentials entry failed. Please try again. Error: ${error}`
          );
          throw error;
        }

        const retry = await NotificationManager.showConfirmation(
          `An error occurred during credentials entry. Would you like to try again? (${retryCount}/${maxRetries})`
        );

        if (!retry) {
          throw new Error("Cancelled by user");
        }

        // Add a short delay
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
      // Create the global storage directory if it doesn't exist
      const dir = path.dirname(this.credentialsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Encrypt and save the credentials
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
      console.error("Error saving credentials:", error);
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
      console.error("Error reading saved credentials:", error);
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

    throw new Error("AWS credentials not found. Please enter them first.");
  }

  async resetCredentials(): Promise<void> {
    try {
      if (fs.existsSync(this.credentialsPath)) {
        fs.unlinkSync(this.credentialsPath);
        NotificationManager.showSuccess("AWS credentials successfully reset!");
      } else {
        NotificationManager.showInfo("No saved credentials found.");
      }
    } catch (error) {
      NotificationManager.showError(`Error resetting credentials: ${error}`);
      throw error;
    }
  }

  async updateCredentials(): Promise<void> {
    try {
      // First, reset the current credentials
      await this.resetCredentials();

      // Get new credentials
      await this.promptForCredentials();

      NotificationManager.showSuccess("AWS credentials successfully updated!");
    } catch (error) {
      NotificationManager.showError(`Error updating credentials: ${error}`);
      throw error;
    }
  }

  async showCredentials(): Promise<void> {
    try {
      const savedCredentials = await this.getSavedCredentials();

      if (savedCredentials) {
        const maskedAccessKey =
          savedCredentials.accessKeyId.substring(0, 4) +
          "..." +
          savedCredentials.accessKeyId.substring(
            savedCredentials.accessKeyId.length - 4
          );
        const maskedSecretKey =
          savedCredentials.secretAccessKey.substring(0, 4) +
          "..." +
          savedCredentials.secretAccessKey.substring(
            savedCredentials.secretAccessKey.length - 4
          );

        const message = `AWS Credentials Information:\n\nAccess Key ID: ${maskedAccessKey}\nSecret Access Key: ${maskedSecretKey}\nRegion: ${savedCredentials.region}`;

        await vscode.window.showInformationMessage(message, "OK");
      } else {
        NotificationManager.showInfo("No saved AWS credentials found.");
      }
    } catch (error) {
      NotificationManager.showError(`Error displaying credentials: ${error}`);
    }
  }
}
