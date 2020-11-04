import util from 'util';
import cp from 'child_process';
import path from 'path';

const execPromise = util.promisify(cp.exec);

export interface ResultSuccess {
  type: 'success';
  output: string;
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

export class Runner {
  private readonly containerId: string;

  private readonly language: Language;

  constructor(containerId: string, language: Language) {
    this.containerId = containerId;
    this.language = language;
  }

  public async kill(): Promise<void> {
    await execPromise(`docker kill ${this.containerId}`);
  }

  public async testInputFile(inputFile: string, timeout: number): Promise<Result> {
    try {
      await execPromise(`docker cp ${path.resolve(inputFile)} ${this.containerId}:/tmp/input.txt`);
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
}

export async function createRunner(file: string): Promise<Runner> {
  const ext = path.extname(file);
  let language: Language;
  if (ext === '.cpp') language = Language.Cpp;
  else if (ext === '.py') language = Language.Python;
  else throw new Error(`Unknown extension ${ext}`);

  const containerId = (await execPromise('docker run -d -i --rm dominikkorsa/runner:1.0.0')).stdout.trim();
  try {
    if (language === Language.Cpp) {
      await execPromise(`docker cp ${path.resolve(file)} ${containerId}:/tmp/code.cpp`);
      await execPromise(`docker exec ${containerId} g++ /tmp/code.cpp -o /tmp/code`);
    } else {
      await execPromise(`docker cp ${path.resolve(file)} ${containerId}:/tmp/code.py`);
    }
  } catch (error) {
    await execPromise(`docker kill ${containerId}`);
    throw error;
  }
  return new Runner(containerId, language);
}
