import path from 'path';
import eol from 'eol';
import cp from 'child_process';
import _ from 'lodash';
import slash from 'slash';
import readline from 'readline';
import {
 b64decode, b64encode, execPromise, execWithInput,
} from './utils';
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
  stderr?: string;
}

export interface ResultTimeoutError {
  type: 'timeout';
}

export type Result = ResultSuccess | ResultRuntimeError | ResultTimeoutError;

export enum Language {
  Python,
  Cpp,
}

const containerImageName = 'dominikkorsa/runner:2.0.0';

export class Runner {
  private container?: {
    id: string;
    process: cp.ChildProcessWithoutNullStreams;
    rl: readline.Interface;
  };

  private language?: Language;

  public async start(): Promise<void> {
    if (this.container !== undefined) return;
    const containerId = (await execPromise(`docker run -d -i --rm ${containerImageName}`)).stdout.trim();
    try {
      const runnerProcess = cp.spawn(`docker exec -i ${containerId} python -u "/var/runner.py"`, { shell: true });
      const rl = readline.createInterface({
        input: runnerProcess.stdout,
      });
      rl.on('close', () => this.onEnd());
      rl.on('line', (line) => this.handleLine(line));
      this.container = {
        id: containerId,
        process: runnerProcess,
        rl,
      };
    } catch (error) {
      await execPromise(`docker kill ${containerId}`);
      throw error;
    }
  }

  private resultsQueue: ((result: Result) => unknown)[] = [];

  private async handleLine(line: string) {
    const json = b64decode(line.trim());
    const result = JSON.parse(json) as Result;
    const handler = this.resultsQueue.shift();
    if (handler === undefined) throw new Error('Queue is empty');
    handler(result);
  }

  private exitHandlers: (() => unknown)[] = [];

  private async onEnd() {
    if (this.container === undefined) throw new ContainerNotStartedError();
    await execPromise(`docker kill ${this.container.id}`);
    this.exitHandlers.forEach((handler) => handler());
    this.exitHandlers = [];
    this.container = undefined;
    this.language = undefined;
  }

  public async stop(): Promise<void> {
    if (this.container === undefined) return;
    const promise = new Promise((resolve) => this.exitHandlers.push(resolve));
    this.container.process.stdin.end();
    await promise;
  }

  public async sendCodeFile(file: string): Promise<void> {
    if (this.container === undefined) throw new ContainerNotStartedError();

    const ext = path.extname(file);
    if (ext === '.cpp') this.language = Language.Cpp;
    else if (ext === '.py') this.language = Language.Python;
    else throw new UnknownExtensionError(ext);

    if (this.language === Language.Cpp) {
      await execPromise(`docker cp "${path.resolve(file)}" "${this.container.id}:/tmp/code.cpp"`);
      await execPromise(`docker exec ${this.container.id} g++ "/tmp/code.cpp" -o "/tmp/code"`);
    } else {
      await execPromise(`docker cp "${path.resolve(file)}" "${this.container.id}:/tmp/code.py"`);
    }
  }

  public async sendCodeText(text: string, language: Language): Promise<void> {
    if (this.container === undefined) throw new ContainerNotStartedError();
    if (language === Language.Cpp) {
      await execWithInput(`docker exec -i ${this.container.id} cp "/dev/stdin" "/tmp/code.cpp"`, text);
      await execPromise(`docker exec ${this.container.id} g++ "/tmp/code.cpp" -o "/tmp/code"`);
    } else {
      await execWithInput(`docker exec -i ${this.container.id} cp "/dev/stdin" "/tmp/code.py"`, text);
    }
    this.language = language;
  }

  public async sendInputFile(file: string): Promise<string> {
    if (this.container === undefined) throw new ContainerNotStartedError();
    const containerPath = slash(path.join(`/tmp/inputs/${Math.floor(Date.now() / 1000)}-${_.random(10000, 99999)}.in`));
    await execPromise(`docker cp "${path.resolve(file)}" "${this.container.id}:${containerPath}"`);
    return containerPath;
  }

  public async sendInputText(text: string): Promise<string> {
    if (this.container === undefined) throw new ContainerNotStartedError();
    const containerPath = slash(path.join(`/tmp/inputs/${Math.floor(Date.now() / 1000)}-${_.random(10000, 99999)}.in`));
    await execWithInput(`docker exec -i ${this.container.id} cp "/dev/stdin" "${containerPath}"`, text);
    return containerPath;
  }

  public async test(inputContainerPath: string, timeout: number): Promise<Result> {
    return new Promise<Result>((resolve, reject) => {
      if (this.container === undefined) {
        reject(new ContainerNotStartedError());
        return;
      }
      if (this.language === undefined) {
        reject(new CodeNotSentError());
        return;
      }
      let command: string;
      if (this.language === Language.Cpp) command = '"/tmp/code"';
      else command = 'python "/tmp/code.py"';
      const request = {
        input: inputContainerPath,
        command,
        timeout,
      };
      this.resultsQueue.push(resolve);
      this.container.process.stdin.write(`${b64encode(JSON.stringify(request))}\n`);
    });
  }

  public async saveOutput(outputContainerPath: string, savePath: string): Promise<void> {
    if (this.container === undefined) throw new ContainerNotStartedError();
    await execPromise(`docker cp "${this.container.id}:${outputContainerPath}" "${path.resolve(savePath)}"`);
  }

  public getOutputAsText(outputContainerPath: string): Promise<string> {
    return new Promise(((resolve, reject) => {
      if (this.container === undefined) {
        reject(new ContainerNotStartedError());
        return;
      }
      const process = cp.spawn(
        `docker exec ${this.container.id} cat "${outputContainerPath}"`,
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
    return this.container !== undefined;
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
