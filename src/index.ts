import path from 'path';
import _ from 'lodash';
import slash from 'slash';
import readline from 'readline';
import Docker from 'dockerode';
import Stream from 'stream';
import {
  b64decode, b64encode, extractTar, packTar, sleep,
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

export type Extension = '.cpp' | '.py';

/**
 * Every runner instance manages a single container.
 * There can be only one code file at the same time in each container.
 * There can be multiple runners active simultaneously.
 */
export class Runner {
  public readonly docker: Docker;

  private instance?: {
    container: Docker.Container;
    rl: readline.ReadLine;
    stream: NodeJS.ReadWriteStream;
  };

  private extension?: Extension;

  private readonly imageName: string;

  /**
   * Creates a Runner instance.
   * @param dockerOptions - Options passed to dockerode constructor.
   * @param imageName - Container image to use instead of the default one.
   */
  public constructor(dockerOptions?: Docker.DockerOptions, imageName = 'dominikkorsa/runner:2.1.1') {
    this.docker = new Docker(dockerOptions);
    this.imageName = imageName;
  }

  /**
   * Starts the docker container.
   * Does nothing if already started.
   */
  public async start(): Promise<void> {
    if (this.instance !== undefined) return;
    const container = await this.docker.createContainer({
      Image: this.imageName,
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
      stream.once('end', () => this.onEnd());
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

  /**
   * Stops the docker container.
   * Does nothing if not started.
   */
  public async stop(): Promise<void> {
    if (this.instance === undefined) return;
    const promise = new Promise((resolve) => this.exitHandlers.push(resolve));
    this.instance.stream.end();
    await promise;
  }

  /**
   * Sends code to be used for testing.
   * There can only be one code file at the same time.
   * @param data - Content of the code to send.
   * @param extension - Extension of the code file, for example: `.cpp`.
   * Supported languages: {@link Extension}.
   * @throws {@link UnknownExtensionError}
   */
  public async sendCode(data: string | Buffer, extension: string): Promise<void> {
    if (this.instance === undefined) throw new ContainerNotStartedError();
    let containerFilename: string;
    if (extension === '.cpp') containerFilename = 'code.cpp';
    else if (extension === '.py') containerFilename = 'code.py';
    else throw new UnknownExtensionError(extension);
    const pack = packTar({
      data,
      name: containerFilename,
    });
    await this.instance.container.putArchive(pack, {
      path: '/tmp',
    });
    if (extension === '.cpp') await this.execCommand(['g++', '/tmp/code.cpp', '-o', '/tmp/code']);
    this.extension = extension;
  }

  /**
   * Sends multiple inputs to the container
   * There can be multiple input files on the docker container
   * @param inputs - array of inputs data to be sent
   * @returns Path to input files on the container, in the same order as inputs
   */
  public async sendInputs(inputs: (string | Buffer)[]): Promise<string[]> {
    if (this.instance === undefined) throw new ContainerNotStartedError();
    const containerDir = '/tmp/inputs';
    const pairs = inputs.map((data) => {
      const containerFilename = `${Math.floor(Date.now() / 1000)}-${_.random(10000, 99999)}.in`;
      const containerPath = slash(path.join(containerDir, containerFilename));
      return {
        file: {
          name: containerFilename,
          data,
        },
        containerPath,
      };
    });
    const pack = packTar(...pairs.map(({ file }) => file));
    await this.instance.container.putArchive(pack, {
      path: containerDir,
    });
    return pairs.map(({ containerPath }) => containerPath);
  }

  /**
   * Sends input to the container
   * There can be multiple input files on the docker container
   * @param data - input data to be sent
   * @returns Path to input file on the container.
   */
  public async sendInput(data: string | Buffer): Promise<string> {
    const [containerPath] = await this.sendInputs([data]);
    return containerPath;
  }

  /**
   * Adds the input to the run queue, then tests the sent code against an input.
   * @param inputContainerPath - Path to input file on the container.
   * Return value of {@link sendInput}.
   * @param timeout - Time in seconds after which the test will fail.
   */
  public async run(inputContainerPath: string, timeout: number): Promise<Result> {
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

  /**
   * Used to get back the output of a run.
   * The returned Buffer can be decoded to a string using `output.decode('utf-8')`
   * @param outputContainerPath - {@link ResultSuccess.outputContainerPath}
   */
  public async getOutput(outputContainerPath: string): Promise<Buffer> {
    if (this.instance === undefined) throw new ContainerNotStartedError();
    const pack = await this.instance.container.getArchive({
      path: outputContainerPath,
    });
    return extractTar(pack, path.basename(outputContainerPath));
  }

  /**
   * Returns `true` if the container has been started and `false` otherwise
   */
  public isStarted(): boolean {
    return this.instance !== undefined;
  }

  private async execCommand(cmd: string[]) {
    if (this.instance === undefined) throw new ContainerNotStartedError();
    const exec = await this.instance.container.exec({
      Cmd: cmd,
    });
    const stream = await exec.start({});
    let info: Docker.ExecInspectInfo;
    do {
      await sleep(500);
      info = await exec.inspect();
    } while (info.ExitCode === null);
    stream.destroy();
    if (info.ExitCode !== 0) throw new Error(`Exec command exited with code ${info.ExitCode}`);
  }

  /**
   * Attempts to connect to the Docker daemon.
   * Returns `true` if successful, `false` otherwise.
   */
  public async ping(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Pulls the container image to the machine running Docker.
   * Returns when completed.
   */
  public async pullImage(): Promise<void> {
    if (await this.isImagePulled()) return;
    const stream: Stream.Readable = await this.docker.pull(this.imageName);
    await new Promise((resolve) => {
      stream.once('end', () => resolve());
      stream.resume();
    });
  }

  /**
   * Checks if container image is pulled.
   */
  public async isImagePulled(): Promise<boolean> {
    try {
      await this.docker.getImage(this.imageName).get();
      return true;
    } catch (error) {
      if (typeof error.statusCode === 'number' && error.statusCode === 404) return false;
      throw error;
    }
  }

  /**
   * Removes the container image from the machine running Docker.
   */
  public async removeImage(): Promise<void> {
    if (!await this.isImagePulled()) return;
    await this.docker.getImage(this.imageName).remove();
  }
}
