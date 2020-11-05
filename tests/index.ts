import { expect } from 'chai';
import path from 'path';
import * as fs from 'fs';
import { Runner } from '../src';

const res = path.resolve(__dirname, './resources');

function resFile(file: string) {
  return path.resolve(res, file);
}

function readFile(file: string): Promise<string> {
  return fs.promises.readFile(resFile(file), 'utf-8');
}

describe('Run C++ tests', () => {
  const runner = new Runner();

  it('Start runner', async function () {
    this.slow(10000);
    this.timeout(90000);
    await runner.start();
    expect(runner.isStarted()).to.equal(true);
  });

  it('Send valid code', async function () {
    if (!runner.isStarted()) this.skip();
    this.slow(5000);
    this.timeout(90000);
    await runner.sendCode(resFile('code/1-valid.cpp'));
  });

  it('Report success', async function () {
    if (!runner.isStarted()) this.skip();
    this.slow(5000);
    this.timeout(90000);
    const result = await runner.testInputFile(resFile('input/1.in'), 30);

    expect(result).property('type').to.equal('success');
  });

  it('Report success on second test', async function () {
    if (!runner.isStarted()) this.skip();
    this.slow(5000);
    this.timeout(90000);
    const result = await runner.testInputFile(resFile('input/2.in'), 30);

    expect(result).property('type').to.equal('success');
  });

  // it('Send invalid code', async function () {
  //   if (!runner.isStarted()) this.skip();
  //   this.slow(5000);
  //   this.timeout(90000);
  //   await runner.sendCode(resFile('code/1-invalid.cpp'));
  // });

  it('Send runtime error code', async function () {
    if (!runner.isStarted()) this.skip();
    this.slow(5000);
    this.timeout(90000);
    await runner.sendCode(resFile('code/1-error.cpp'));
  });

  it('Report runtime error', async function () {
    if (!runner.isStarted()) this.skip();
    this.slow(5000);
    this.timeout(90000);

    const result = await runner.testInputFile(resFile('input/1.in'), 30);
    expect(result).property('type').to.equal('runtime-error');
  });

  it('Send timeout code', async function () {
    if (!runner.isStarted()) this.skip();
    this.slow(5000);
    this.timeout(90000);
    await runner.sendCode(resFile('code/1-timeout.cpp'));
  });

  it('Report timeout', async function () {
    if (!runner.isStarted()) this.skip();
    this.slow(30000);
    this.timeout(90000);

    const result = await runner.testInputFile(resFile('input/1.in'), 10);
    expect(result).property('type').to.equal('timeout');
  });

  it('Kill runner', async function () {
    if (!runner.isStarted()) return;
    this.slow(5000);
    this.timeout(90000);
    await runner.kill();
    expect(runner.isStarted()).to.equal(false);
  });
});
