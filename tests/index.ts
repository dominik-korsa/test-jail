import { expect, use } from 'chai';
import path from 'path';
import fse from 'fs-extra';
import eol from 'eol';
import chaiAsPromised from 'chai-as-promised';
import {
  CodeNotSentError,
  ContainerNotStartedError,
  ResultSuccess,
  Runner, UnknownExtensionError,
} from '../src';
import { b64decode, b64encode } from '../src/utils';

use(chaiAsPromised);

const res = path.resolve(__dirname, './resources');

function resFile(file: string) {
  return path.resolve(res, file);
}

function readResFile(file: string): Promise<string> {
  return fse.readFile(resFile(file), 'utf-8');
}

function resFileBuffer(file: string): Promise<Buffer> {
  return fse.readFile(resFile(file));
}

function expectOutputEquals(out1: string, out2: string) {
  expect(eol.lf(out1).trimEnd()).to.equal(eol.lf(out2).trimEnd());
}

describe('Run tests', () => {
  const runner = new Runner();

  it('Test Docker available', async () => {
    expect(await runner.ping()).to.equal(true);
    const fakeRunner = new Runner({
      socketPath: 'localhost:1234',
    });
    expect(await runner.ping()).to.equal(true);
    expect(await fakeRunner.ping()).to.equal(false);
  });

  it('Image management', async function () {
    this.slow(30000);
    this.timeout(300000);
    const fakeImageRunner = new Runner(undefined, 'hello-world');
    await fakeImageRunner.removeImage();
    expect(await fakeImageRunner.isImagePulled()).to.equal(false);
    await fakeImageRunner.pullImage();
    expect(await fakeImageRunner.isImagePulled()).to.equal(true);
    await fakeImageRunner.removeImage();
    expect(await fakeImageRunner.isImagePulled()).to.equal(false);
  });

  it('Container not started errors', async () => {
    expect(runner.isStarted()).to.equal(false);
    await expect(runner.sendCode(await resFileBuffer('code/1-valid.cpp'), '.cpp'))
      .to.eventually.be.rejectedWith(ContainerNotStartedError);
    await expect(runner.getOutput('/tmp/outputs/example.out'))
      .to.eventually.be.rejectedWith(ContainerNotStartedError);
    await expect(runner.sendInput('1 2 3\n4 5 6'))
      .to.eventually.be.rejectedWith(ContainerNotStartedError);
    await expect(runner.test('/tmp/inputs/example.in', 30))
      .to.eventually.be.rejectedWith(ContainerNotStartedError);
    expect(runner.isStarted()).to.equal(false);
    await expect(runner.stop()).to.be.fulfilled;
  });

  it('Start runner', async function () {
    this.slow(10000);
    this.timeout(90000);
    await runner.start();
    expect(runner.isStarted()).to.equal(true);
  });

  it('Start runner again', async function () {
    if (!runner.isStarted()) {
      this.skip();
      return;
    }
    await runner.start();
    expect(runner.isStarted()).to.equal(true);
  });

  it('Code not sent error', async function () {
    if (!runner.isStarted()) {
      this.skip();
      return;
    }
    await expect(runner.test('/tmp/outputs/example.out', 30))
      .to.eventually.be.rejectedWith(CodeNotSentError);
  });

  it('Send valid C++ code', async function () {
    if (!runner.isStarted()) {
      this.skip();
      return;
    }
    this.slow(5000);
    this.timeout(90000);
    await runner.sendCode(await resFileBuffer('code/1-valid.cpp'), '.cpp');
  });

  let in1ContainerPath: string | undefined;
  let in2ContainerPath: string | undefined;

  it('Send input 1 as buffer', async function () {
    if (!runner.isStarted()) {
      this.skip();
      return;
    }
    this.slow(5000);
    this.timeout(90000);
    in1ContainerPath = await runner.sendInput(await resFileBuffer('input/1.in'));
  });

  it('Report success, get output', async function () {
    if (!runner.isStarted() || in1ContainerPath === undefined) {
      this.skip();
      return;
    }
    this.slow(5000);
    this.timeout(90000);
    const result = await runner.test(in1ContainerPath, 30) as ResultSuccess;
    expect(result).property('type').to.equal('success');
    const output = await runner.getOutput(result.outputContainerPath);
    expectOutputEquals(output.toString('utf-8'), await readResFile('expected-output/1.out'));
  });

  it('Send input 2 as string', async function () {
    if (!runner.isStarted()) {
      this.skip();
      return;
    }
    this.slow(5000);
    this.timeout(90000);
    in2ContainerPath = await runner.sendInput(await readResFile('input/2.in'));
  });

  it('Report success on second test, get output as text', async function () {
    if (!runner.isStarted() || in2ContainerPath === undefined) {
      this.skip();
      return;
    }
    this.slow(5000);
    this.timeout(90000);
    const result = await runner.test(in2ContainerPath, 30) as ResultSuccess;
    expect(result).property('type').to.equal('success');
    const output = await runner.getOutput(result.outputContainerPath);
    expectOutputEquals(output.toString('utf-8'), await readResFile('expected-output/2.out'));
  });

  it('Get nonexistent output file', async function () {
    if (!runner.isStarted()) {
      this.skip();
      return;
    }
    this.slow(5000);
    this.timeout(90000);
    await expect(runner.getOutput('/tmp/outputs/does-not-exist.out'))
      .to.eventually.be.rejected;
  });

  it('C++ runtime error', async function () {
    if (!runner.isStarted() || in1ContainerPath === undefined) {
      this.skip();
      return;
    }
    this.slow(10000);
    this.timeout(90000);
    await runner.sendCode(await resFileBuffer('code/1-error.cpp'), '.cpp');
    const result = await runner.test(in1ContainerPath, 30);
    expect(result).property('type').to.equal('runtime-error');
  });

  it('C++ timeout - code as string', async function () {
    if (!runner.isStarted() || in1ContainerPath === undefined) {
      this.skip();
      return;
    }
    this.slow(20000);
    this.timeout(90000);
    const code = await readResFile('code/1-timeout.cpp');
    await runner.sendCode(code, '.cpp');
    const result = await runner.test(in1ContainerPath, 5);
    expect(result).property('type').to.equal('timeout');
  });

  it('Python success - code as string', async function () {
    if (!runner.isStarted() || in2ContainerPath === undefined) {
      this.skip();
      return;
    }
    this.slow(10000);
    this.timeout(90000);
    const code = await readResFile('code/1-valid.py');
    await runner.sendCode(code, '.py');
    const result = await runner.test(in2ContainerPath, 5);
    expect(result).property('type').to.equal('success');
  });

  it('Python runtime error', async function () {
    if (!runner.isStarted() || in2ContainerPath === undefined) {
      this.skip();
      return;
    }
    this.slow(10000);
    this.timeout(90000);
    await runner.sendCode(await resFileBuffer('code/1-error.py'), '.py');
    const result = await runner.test(in2ContainerPath, 30);
    expect(result).property('type').to.equal('runtime-error');
  });

  it('Python timeout', async function () {
    if (!runner.isStarted() || in2ContainerPath === undefined) {
      this.skip();
      return;
    }
    this.slow(20000);
    this.timeout(90000);
    await runner.sendCode(await resFileBuffer('code/1-timeout.py'), '.py');
    const result = await runner.test(in2ContainerPath, 5);
    expect(result).property('type').to.equal('timeout');
  });

  it('Queue tests', async function () {
    if (!runner.isStarted() || in1ContainerPath === undefined || in2ContainerPath === undefined) {
      this.skip();
      return;
    }
    this.slow(5000);
    this.timeout(90000);
    await runner.sendCode(await resFileBuffer('code/1-valid.cpp'), '.cpp');
    const test1 = runner.test(in1ContainerPath, 30) as Promise<ResultSuccess>;
    const test2 = runner.test(in2ContainerPath, 30) as Promise<ResultSuccess>;
    const result1 = await test1;
    const result2 = await test2;
    expect(result1).property('type').to.equal('success');
    expect(result2).property('type').to.equal('success');
    const output1 = await runner.getOutput(result1.outputContainerPath);
    const output2 = await runner.getOutput(result2.outputContainerPath);
    expectOutputEquals(
      output1.toString('utf-8'),
      await readResFile('expected-output/1.out'),
    );
    expectOutputEquals(
      output2.toString('utf-8'),
      await readResFile('expected-output/2.out'),
    );
  });

  it('Unknown extension', async () => {
    expect(runner.sendCode('console.log("never gonna let you down!")', '.js'))
      .to.eventually.be.rejectedWith(UnknownExtensionError);
  });

  it('Stop runner', async function () {
    if (!runner.isStarted()) {
      this.skip();
      return;
    }
    this.slow(5000);
    this.timeout(60000);
    await runner.stop();
    expect(runner.isStarted()).to.equal(false);
  });
});

describe('Utils tests', () => {
  it('Base 64 encode', () => {
    expect(b64encode('This is a test')).to.equal('VGhpcyBpcyBhIHRlc3Q=');
    expect(b64encode('This text\nis multiline')).to.equal('VGhpcyB0ZXh0CmlzIG11bHRpbGluZQ==');
    expect(b64encode('{\n  "number": 5,\n  "text": "smth",\n  "array": [1, 2, 3]\n}'))
      .to.equal('ewogICJudW1iZXIiOiA1LAogICJ0ZXh0IjogInNtdGgiLAogICJhcnJheSI6IFsxLCAyLCAzXQp9');
  });

  it('Base 64 decode', () => {
    expect(b64decode('VGhpcyBpcyBhIHRlc3Q=')).to.equal('This is a test');
    expect(b64decode('VGhpcyB0ZXh0CmlzIG11bHRpbGluZQ==')).to.equal('This text\nis multiline');
    expect(b64decode('ewogICJudW1iZXIiOiA1LAogICJ0ZXh0IjogInNtdGgiLAogICJhcnJheSI6IFsxLCAyLCAzXQp9'))
      .to.equal('{\n  "number": 5,\n  "text": "smth",\n  "array": [1, 2, 3]\n}');
  });
});
