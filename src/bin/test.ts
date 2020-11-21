import fse from 'fs-extra';
import { Result, Runner } from '../index';

export default class Test {
  public waitInputSent: Promise<void>;

  public waitTestCompleted: Promise<Result>;

  private inputSentFunctions!: {
    resolve: () => void;
    reject: (reason: unknown) => void;
  };

  private waitTestCompletedFunctions!: {
    resolve: (result: Result) => void;
    reject: (reason: unknown) => void;
  };

  private runner: Runner;

  private inputContainerPath?: string;

  private inputFile: string;

  public inputFileRelative: string;

  public constructor(runner: Runner, inputFile: string, inputFileRelative: string) {
    this.runner = runner;
    this.inputFile = inputFile;
    this.inputFileRelative = inputFileRelative;
    this.waitInputSent = new Promise((resolve, reject) => {
      this.inputSentFunctions = { resolve, reject };
    });
    this.waitTestCompleted = new Promise((resolve, reject) => {
      this.waitTestCompletedFunctions = { resolve, reject };
    });
  }

  public getInputBuffer(): Promise<Buffer> {
    return fse.readFile(this.inputFile);
  }

  public setInputSent(inputContainerPath: string): void {
    this.inputContainerPath = inputContainerPath;
    this.inputSentFunctions.resolve();
  }

  public test(timeout: number): Promise<Result> {
    if (!this.inputContainerPath) {
      this.waitTestCompletedFunctions.reject(new Error('Input not sent'));
    } else {
      this.runner.run(this.inputContainerPath, timeout)
        .then(this.waitTestCompletedFunctions.resolve)
        .catch(this.waitTestCompletedFunctions.reject);
    }
    return this.waitTestCompleted;
  }

  public async saveOutput(outputFile: string): Promise<void> {
    const result = await this.waitTestCompleted;
    if (result.type !== 'success') throw new Error('Result type is not success');
    const outputBuffer = await this.runner.getOutput(result.outputContainerPath);
    await fse.writeFile(
      outputFile,
      outputBuffer,
    );
  }
}
