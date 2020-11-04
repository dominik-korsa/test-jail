import { expect } from 'chai';
import path from 'path';
import {createRunner, Runner} from '../src';
import * as fs from "fs";

const res = path.resolve(__dirname, './resources');

function resFile(file: string) {
  return path.resolve(res, file);
}

function readFile(file: string): Promise<string> {
  return fs.promises.readFile(resFile(file), 'utf-8');
}

describe('Run C++ tests', () => {
  let runner: Runner;
  it('Start runner', async function () {
    this.slow(10000);
    this.timeout(90000);
    runner = await createRunner(resFile('code/1-valid.cpp'));
  });

  it('Report success', async function () {
    if (!runner) this.skip();
    this.slow(5000);
    this.timeout(90000);
    const result = await runner.testInputFile(resFile('input/1.in'), 30);

    expect(result).property('type').to.equal('success');
  });

  it('Kill runner', async function () {
    if (!runner) this.skip();
    this.slow(5000);
    this.timeout(90000);
    await runner.kill();
  });
});
