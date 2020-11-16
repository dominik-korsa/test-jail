import path from 'path';
import eol from 'eol';
import _ from 'lodash';
import slash from 'slash';
import readline from 'readline';
import Docker from 'dockerode';
import Stream from 'stream';
import {
  b64decode, b64encode, execPromise, extractTar, packTar, sleep,
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

export type Language = '.cpp' | '.py';

const containerImageName = 'dominikkorsa/runner:2.1.1';

export class Runner {
  private docker: Docker;

  private instance?: {
    container: Docker.Container;
    rl: readline.ReadLine;
    stream: NodeJS.ReadWriteStream;
  };

  private extension?: Language;

  public constructor(dockerOptions?: Docker.DockerOptions) {
    this.docker = new Docker(dockerOptions);
  }

  public async start(): Promise<void> {
    if (this.instance !== undefined) return;
    const container = await this.docker.createContainer({
      Image: containerImageName,
      HostConfig: {
        AutoRemove: true,
      },
      StdinOnce: true,
      OpenStdin: true,
    });
    await container.start();
    try {
      const stream = await container.attach({
        stream: true,
        stdin: true,
        stdout: true,
      });
      const stdout = new Stream.PassThrough();
      container.modem.demuxStream(stream, stdout, stdout);
      const rl = readline.createInterface({
        input: stdout,
      });
      stream.on('end', () => this.onEnd());
      rl.on('line', (line) => this.handleLine(line));
      this.instance = {
        container,
        rl,
        stream,
      };
    } catch (error) {
      await container.kill();
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
    this.exitHandlers.forEach((handler) => handler());
    this.exitHandlers = [];
    this.instance = undefined;
    this.extension = undefined;
  }

  public async stop(): Promise<void> {
    if (this.instance === undefined) return;
    const promise = new Promise((resolve) => this.exitHandlers.push(resolve));
    this.instance.stream.end();
    await promise;
  }

  public async sendCode(data: string | Buffer, extension: string): Promise<void> {
    if (this.instance === undefined) throw new ContainerNotStartedError();
    let containerFilename: string;
    if (extension === '.cpp') containerFilename = 'code.cpp';
    else if (extension === '.py') containerFilename = 'code.py';
    else throw new UnknownExtensionError(extension);
    const pack = packTar({
      name: containerFilename,
    }, data);
    await this.instance.container.putArchive(pack, {
      path: '/tmp',
    });
    if (extension === '.cpp') await this.execCommand(['g++', '/tmp/code.cpp', '-o', '/tmp/code']);
    this.extension = extension;
  }

  public async sendInput(data: string | Buffer): Promise<string> {
    if (this.instance === undefined) throw new ContainerNotStartedError();
    const containerDir = '/tmp/inputs';
    const containerFilename = `${Math.floor(Date.now() / 1000)}-${_.random(10000, 99999)}.in`;
    const containerPath = slash(path.join(containerDir, containerFilename));
    const pack = packTar({
        name: containerFilename,
        type: 'file',
      }, data);
    await this.instance.container.putArchive(pack, {
      path: containerDir,
    });
    return containerPath;
  }

  public async test(inputContainerPath: string, timeout: number): Promise<Result> {
    return new Promise<Result>((resolve, reject) => {
      if (this.instance === undefined) {
        reject(new ContainerNotStartedError());
        return;
      }
      if (this.extension === undefined) {
        reject(new CodeNotSentError());
        return;
      }
      let command: string;
      if (this.extension === '.cpp') command = '"/tmp/code"';
      else command = 'python "/tmp/code.py"';
      const request = {
        input: inputContainerPath,
        command,
        timeout,
      };
      this.resultsQueue.push(resolve);
      this.instance.stream.write(`${b64encode(JSON.stringify(request))}\n`);
    });
  }

  public async getOutput(outputContainerPath: string): Promise<Buffer> {
    if (this.instance === undefined) throw new ContainerNotStartedError();
    const pack = await this.instance.container.getArchive({
      path: outputContainerPath,
    });
    return extractTar(pack, path.basename(outputContainerPath));
  }

  public isStarted(): boolean {
    return this.instance !== undefined;
  }

  private async execCommand(cmd: string[]) {
    if (this.instance === undefined) throw new ContainerNotStartedError();
    const exec = await this.instance.container.exec({
      Cmd: cmd,
    });
    await exec.start({});
    let info: Docker.ExecInspectInfo;
    do {
      await sleep(500);
      info = await exec.inspect();
    } while (info.ExitCode === null);
    if (info.ExitCode !== 0) throw new Error(`Exec command exited with code ${info.ExitCode}`);
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
