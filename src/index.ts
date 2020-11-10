import path from 'path';
import eol from 'eol';
import cp from 'child_process';
import { execPromise, execWithInput } from './utils';
import { CodeNotSentError, ContainerNotStartedError, UnknownExtensionError } from './errors';

export * from './errors';

export interface ResultSuccess {
  type: 'success';
  outputContainerPath: string;
  time: number;
}

export interface ResultRuntimeError {
  type: 'runtime-error';
  message: string;
}

export interface ResultTimeoutError {
  type: 'timeout';
}

export type Result = ResultSuccess | ResultRuntimeError | ResultTimeoutError;

export enum Language {
  Python,
  Cpp,
}

const containerImageName = 'dominikkorsa/runner:1.1.0';

export class Runner {
  private containerId?: string;

  private language?: Language;

  public async start(): Promise<void> {
    if (this.containerId !== undefined) return;
    this.containerId = (await execPromise(`docker run -d -i --rm ${containerImageName}`)).stdout.trim();
  }

  public async kill(): Promise<void> {
    if (this.containerId === undefined) return;
    await execPromise(`docker kill ${this.containerId}`);
    this.containerId = undefined;
    this.language = undefined;
  }

  public async sendCodeFile(file: string): Promise<void> {
    if (this.containerId === undefined) throw new ContainerNotStartedError();

    const ext = path.extname(file);
    if (ext === '.cpp') this.language = Language.Cpp;
    else if (ext === '.py') this.language = Language.Python;
    else throw new UnknownExtensionError(ext);

    if (this.language === Language.Cpp) {
      await execPromise(`docker cp ${path.resolve(file)} ${this.containerId}:/tmp/code.cpp`);
      await execPromise(`docker exec ${this.containerId} g++ /tmp/code.cpp -o /tmp/code`);
    } else {
      await execPromise(`docker cp ${path.resolve(file)} ${this.containerId}:/tmp/code.py`);
    }
  }

  public async sendCodeText(text: string, language: Language): Promise<void> {
    if (this.containerId === undefined) throw new ContainerNotStartedError();
    if (language === Language.Cpp) {
      await execWithInput(`docker exec -i ${this.containerId} cp /dev/stdin /tmp/code.cpp`, text);
      await execPromise(`docker exec ${this.containerId} g++ /tmp/code.cpp -o /tmp/code`);
    } else {
      await execWithInput(`docker exec -i ${this.containerId} cp /dev/stdin /tmp/code.py`, text);
    }
    this.language = language;
  }

  public async testInputFile(inputFile: string, timeout: number): Promise<Result> {
    if (this.containerId === undefined) throw new ContainerNotStartedError();
    if (this.language === undefined) throw new CodeNotSentError();
    try {
      await execPromise(`docker cp ${path.resolve(inputFile)} ${this.containerId}:/tmp/input.in`);
      let command: string;
      if (this.language === Language.Cpp) command = '/tmp/code';
      else command = 'python /tmp/code.py';
      const { stdout } = await execPromise(`docker exec ${this.containerId} python /var/runner.py -t ${timeout} ${command}`);
      return JSON.parse(stdout) as Result;
    } catch (error) {
      return {
        type: 'runtime-error',
        message: error.message,
      };
    }
  }

  public async saveOutput(outputContainerPath: string, savePath: string): Promise<void> {
    if (this.containerId === undefined) throw new ContainerNotStartedError();
    await execPromise(`docker cp ${this.containerId}:${outputContainerPath} ${path.resolve(savePath)}`);
  }

  public getOutputAsText(outputContainerPath: string): Promise<string> {
    if (this.containerId === undefined) return Promise.reject(new ContainerNotStartedError());
    return new Promise(((resolve, reject) => {
      const process = cp.spawn(
        `docker exec ${this.containerId} cat ${outputContainerPath}`,
        {
          shell: true,
        },
      );
      let text = '';
      process.stdout.on('data', ((chunk) => {
        text += chunk;
      }));
      process.on('close', (code) => {
        if (code !== 0) reject(new Error(`Process exited with code ${code}`));
        else resolve(text);
      });
      process.on('error', reject);
    }));
  }

  public isStarted(): boolean {
    return this.containerId !== undefined;
  }
}

export async function isImagePulled(): Promise<boolean> {
  const { stdout } = await execPromise(`docker images -q ${containerImageName}`);
  return eol
    .split(stdout)
    .filter((line) => line.trim().length > 0)
    .length > 0;
}

export async function pullContainerImage(): Promise<void> {
  await execPromise(`docker pull ${containerImageName}`);
}

export async function isDockerAvailable(): Promise<boolean> {
  try {
    const { stdout } = await execPromise('docker -v');
    return /Docker version .+, build .+/g.test(stdout);
  } catch (error) {
    return false;
  }
}
