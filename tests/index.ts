import { expect, use } from 'chai';
import path from 'path';
import fse from 'fs-extra';
import eol from 'eol';
import chaiAsPromised from 'chai-as-promised';
import {
  CodeNotSentError,
  ContainerNotStartedError,
  isDockerAvailable,
  isImagePulled,
  Language,
  pullContainerImage,
  ResultSuccess,
  Runner,
  UnknownExtensionError,
} from '../src';
import { b64decode, b64encode } from '../src/utils';

use(chaiAsPromised);

const res = path.resolve(__dirname, './resources');
const temp = path.resolve(__dirname, './temp');

function resFile(file: string) {
  return path.resolve(res, file);
}

function readResFile(file: string): Promise<string> {
  return fse.readFile(resFile(file), 'utf-8');
}

function tempFile(file: string): string {
  return path.resolve(temp, file);
}

function readTempFile(file: string): Promise<string> {
  return fse.readFile(tempFile(file), 'utf-8');
}

function expectOutputEquals(out1: string, out2: string) {
  expect(eol.lf(out1).trimEnd()).to.equal(eol.lf(out2).trimEnd());
}

describe('Run tests', () => {
  const runner = new Runner();

  before(() => {
    fse.emptyDir(temp);
  });

  it('Test Docker available', async () => {
    expect(await isDockerAvailable()).to.equal(true);
  });

  it('Pull docker image', async function () {
    this.slow(30000);
    this.timeout(300000);
    await pullContainerImage();
    expect(await isImagePulled()).to.equal(true);
  });

  it('Container not started errors', async () => {
    expect(runner.isStarted()).to.equal(false);
    await expect(runner.sendCodeFile(resFile('code/1-valid.cpp')))
      .to.eventually.be.rejectedWith(ContainerNotStartedError);
    await expect(runner.sendCodeText('print(input())', Language.Python))
      .to.eventually.be.rejectedWith(ContainerNotStartedError);
    await expect(runner.getOutputAsText('/tmp/outputs/example.out'))
      .to.eventually.be.rejectedWith(ContainerNotStartedError);
    await expect(runner.saveOutput('/tmp/outputs/example.out', tempFile('not-started-output.out')))
      .to.eventually.be.rejectedWith(ContainerNotStartedError);
    await expect(runner.sendInputFile(resFile('input/1.in')))
      .to.eventually.be.rejectedWith(ContainerNotStartedError);
    await expect(runner.sendInputText('1 2 3\n4 5 6'))
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

  it('Unknown extension error', async function () {
    if (!runner.isStarted()) {
      this.skip();
      return;
    }
    await expect(runner.sendCodeFile(resFile('code/1-valid.pas')))
      .to.eventually.be.rejectedWith(UnknownExtensionError);
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
    await runner.sendCodeFile(resFile('code/1-valid.cpp'));
  });

  let in1ContainerPath: string | undefined;
  let in2ContainerPath: string | undefined;

  it('Send input 1 file', async function () {
    if (!runner.isStarted()) {
      this.skip();
      return;
    }
    this.slow(5000);
    this.timeout(90000);
    in1ContainerPath = await runner.sendInputFile(resFile('input/1.in'));
  });

  it('Report success, save output to file', async function () {
    if (!runner.isStarted() || in1ContainerPath === undefined) {
      this.skip();
      return;
    }
    this.slow(5000);
    this.timeout(90000);
    const result = await runner.test(in1ContainerPath, 30) as ResultSuccess;
    expect(result).property('type').to.equal('success');
    await runner.saveOutput(result.outputContainerPath, tempFile('test.out'));
    expectOutputEquals(await readTempFile('test.out'), await readResFile('expected-output/1.out'));
  });

  it('Send input 2 as text', async function () {
    if (!runner.isStarted()) {
      this.skip();
      return;
    }
    this.slow(5000);
    this.timeout(90000);
    in2ContainerPath = await runner.sendInputText(await readResFile('input/2.in'));
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
    const output = await runner.getOutputAsText(result.outputContainerPath);
    expectOutputEquals(output, await readResFile('expected-output/2.out'));
  });

  it('Get nonexistent output file', async function () {
    if (!runner.isStarted()) {
      this.skip();
      return;
    }
    this.slow(5000);
    this.timeout(90000);
    await expect(runner.getOutputAsText('/tmp/outputs/does-not-exist.out'))
      .to.eventually.be.rejected;
    await expect(runner.saveOutput('/tmp/outputs/does-not-exist.out', tempFile('does-not-exist.out')))
      .to.eventually.be.rejected;
  });

  it('C++ runtime error', async function () {
    if (!runner.isStarted() || in1ContainerPath === undefined) {
      this.skip();
      return;
    }
    this.slow(10000);
    this.timeout(90000);
    await runner.sendCodeFile(resFile('code/1-error.cpp'));
    const result = await runner.test(in1ContainerPath, 30);
    expect(result).property('type').to.equal('runtime-error');
  });

  it('C++ timeout - code as text', async function () {
    if (!runner.isStarted() || in1ContainerPath === undefined) {
      this.skip();
      return;
    }
    this.slow(20000);
    this.timeout(90000);
    const code = await readResFile('code/1-timeout.cpp');
    await runner.sendCodeText(code, Language.Cpp);
    const result = await runner.test(in1ContainerPath, 5);
    expect(result).property('type').to.equal('timeout');
  });

  it('Python success - code as text', async function () {
    if (!runner.isStarted() || in2ContainerPath === undefined) {
      this.skip();
      return;
    }
    this.slow(10000);
    this.timeout(90000);
    const code = await readResFile('code/1-valid.py');
    await runner.sendCodeText(code, Language.Python);
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
    await runner.sendCodeFile(resFile('code/1-error.py'));
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
    await runner.sendCodeFile(resFile('code/1-timeout.py'));
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
    await runner.sendCodeFile(resFile('code/1-valid.cpp'));
    const test1 = runner.test(in1ContainerPath, 30) as Promise<ResultSuccess>;
    const test2 = runner.test(in2ContainerPath, 30) as Promise<ResultSuccess>;
    const result1 = await test1;
    const result2 = await test2;
    expect(result1).property('type').to.equal('success');
    expect(result2).property('type').to.equal('success');
    expectOutputEquals(
      await runner.getOutputAsText(result1.outputContainerPath),
      await readResFile('expected-output/1.out'),
    );
    expectOutputEquals(
      await runner.getOutputAsText(result2.outputContainerPath),
      await readResFile('expected-output/2.out'),
    );
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
