import yargs from 'yargs';
import path from 'path';
import fse from 'fs-extra';
import ora from 'ora';
import chalk from 'chalk';
import replaceExt from 'replace-ext';
import Table from 'cli-table3';
import Enquirer from 'enquirer';
import open from 'open';
import * as Diff from 'diff';
import eol from 'eol';
import _ from 'lodash';
import {
  Runner, ResultSuccess,
} from '../index';
import { globPromise, lengthsSum } from '../utils';
import Test from './test';
import RunProgress from './run-progress';
import {
  Chunk,
  OutputOverwriteMode,
  PResultSuccess,
  PResultWrongAnswer,
  PrintableResult,
  RunArgs,
  TestArgs,
} from './types';

function exitWithError(text: string) {
  console.error(chalk`{red {bold Error:} ${text}}`);
  process.exit(1);
}

function printWarning(text: string) {
  console.warn(chalk`{yellowBright {bold Warning:} ${text}}`);
}

function generateLBLChunks(expectedOutput: string[], output: string[]) {
  const chunks: Chunk[] = [];
  for (let i = 0; i < expectedOutput.length && i < output.length; i += 1) {
    const lastChunk: Chunk | undefined = _.last(chunks);
    const expOutLine = expectedOutput[i];
    const outLine = output[i];
    if (expOutLine === outLine) {
      if (lastChunk && !lastChunk.changed) {
        lastChunk.output.push(outLine);
      } else {
        chunks.push({
          changed: false,
          output: [outLine],
        });
      }
    } else if (lastChunk && lastChunk.changed) {
      lastChunk.expectedOutput.push(expOutLine);
      lastChunk.output.push(outLine);
    } else {
      chunks.push({
        changed: true,
        expectedOutput: [expOutLine],
        output: [outLine],
      });
    }
  }
  const lastChunk: Chunk | undefined = _.last(chunks);
  const missingExpOutLines = expectedOutput.slice(output.length);
  const missingOutLines = output.slice(expectedOutput.length);
  if (missingExpOutLines.length > 0) {
    if (lastChunk && lastChunk.changed) {
      lastChunk.expectedOutput.push(...missingExpOutLines);
    } else {
      chunks.push({
        changed: true,
        expectedOutput: missingExpOutLines,
        output: [],
      });
    }
  }
  if (missingOutLines.length > 0) {
    if (lastChunk && lastChunk.changed) {
      lastChunk.output.push(...missingOutLines);
    } else {
      chunks.push({
        changed: true,
        expectedOutput: [],
        output: missingExpOutLines,
      });
    }
  }
  return chunks;
}

function generateDiffChunks(expectedOutput: string[], output: string[]) {
  const diff = Diff.diffArrays(
    expectedOutput,
    output,
  );
  const chunks: Chunk[] = [];
  diff.forEach((change) => {
    const lastChunk: Chunk | undefined = _.last(chunks);
    if (change.added) {
      if (lastChunk && lastChunk.changed) {
        lastChunk.output.push(...change.value);
      } else {
        chunks.push({
          changed: true,
          expectedOutput: [],
          output: [...change.value],
        });
      }
    } else if (change.removed) {
      if (lastChunk && lastChunk.changed) {
        lastChunk.expectedOutput.push(...change.value);
      } else {
        chunks.push({
          changed: true,
          expectedOutput: [...change.value],
          output: [],
        });
      }
    } else {
      chunks.push({
        changed: false,
        output: change.value,
      });
    }
  });
  return chunks;
}

function validLineCell(value: string, expOutLine: number, outLine: number) {
  return [
    chalk.grey(expOutLine), value,
    chalk.grey('│'),
    chalk.grey(outLine), value,
  ];
}

function printOutput(result: PResultWrongAnswer, lbl: boolean) {
  if (Math.max(lengthsSum(result.expectedOutput), lengthsSum(result.output)) > 5000) {
    return 'Output is too long to show';
  }

  const diffTable = new Table({
    chars: {
      top: '',
      'top-mid': '',
      'top-left': '',
      'top-right': '',
      bottom: '',
      'bottom-mid': '',
      'bottom-left': '',
      'bottom-right': '',
      left: '',
      'left-mid': '',
      mid: '',
      'mid-mid': '',
      right: '',
      'right-mid': '',
      middle: ' ',
    },
    style: { 'padding-left': 0, 'padding-right': 0 },
  });

  diffTable.push(
    [
      {
        colSpan: 2,
        content: chalk.blueBright('Expected'),
      },
      chalk.grey(''),
      {
        colSpan: 2,
        content: chalk.blueBright('Actual'),
      },
    ], [
      chalk.blue('#'),
      chalk.blue('Value'),
      chalk.grey(''),
      chalk.blue('#'),
      chalk.blue('Value'),
    ],
  );

  let chunks: Chunk[];
  if (lbl) {
    chunks = generateLBLChunks(
      result.expectedOutput,
      result.output,
    );
  } else {
    chunks = generateDiffChunks(
      result.expectedOutput,
      result.output,
    );
  }

  let outLine = 0;
  let expOutLine = 0;
  chunks.forEach((chunk, index) => {
    if (chunk.changed) {
      const zip = _.zip(chunk.expectedOutput, chunk.output);
      zip.forEach(([expectedOutputValue, outputValue]) => {
        if (expectedOutputValue === undefined) {
          outLine += 1;
          diffTable.push([
            '',
            '',
            chalk.redBright('+'),
            chalk.grey.bold(outLine),
            chalk.redBright.bold(outputValue),
          ]);
        } else if (outputValue === undefined) {
          expOutLine += 1;
          diffTable.push([
            chalk.grey.bold(expOutLine),
            expectedOutputValue,
            chalk.redBright('-'),
            {
              colSpan: 2,
              content: chalk.red('Line missing'),
            },
          ]);
        } else {
          outLine += 1;
          expOutLine += 1;
          diffTable.push([
            chalk.grey.bold(expOutLine),
            expectedOutputValue,
            chalk.redBright('>'),
            chalk.grey.bold(outLine),
            chalk.redBright.bold(outputValue),
          ]);
        }
      });
    } else if (chunk.output.length > 5) {
      const first = index === 0;
      const last = index === chunks.length - 1;
      let hiddenLines = chunk.output.length;
      if (!first) {
        chunk.output.slice(0, 2).forEach(((value) => {
          outLine += 1;
          expOutLine += 1;
          diffTable.push(validLineCell(value, expOutLine, outLine));
        }));
        hiddenLines -= 2;
      }
      if (!last) hiddenLines -= 2;
      diffTable.push([{
        colSpan: 5,
        content: chalk.gray.bold(`(…) ${hiddenLines} lines hidden`),
      }]);
      outLine += hiddenLines;
      expOutLine += hiddenLines;
      if (!last) {
        chunk.output.slice(chunk.output.length - 2).forEach(((value) => {
          outLine += 1;
          expOutLine += 1;
          diffTable.push(validLineCell(value, expOutLine, outLine));
        }));
      }
    } else {
      chunk.output.forEach(((value) => {
        outLine += 1;
        expOutLine += 1;
        diffTable.push(validLineCell(value, expOutLine, outLine));
      }));
    }
  });

  return diffTable.toString();
}

function printResults(
  results: PrintableResult[],
  timeLimit: number,
  lbl: boolean,
  hideSuccess: boolean,
) {
  const resultsTable = new Table({
    head: [
      'File',
      'Status',
      'Execution time',
    ],
    style: {
      head: ['cyan'],
    },
  });

  let successCount = 0;
  results.forEach((result) => {
    if (result.type === 'success' || result.type === 'wrong-answer') {
      if (hideSuccess && result.type === 'success') {
        successCount += 1;
        return;
      }
      const timeRatio = Math.min(result.time / timeLimit, 0.999);
      const colors = [chalk.gray, chalk.white, chalk.yellow, chalk.red];
      const color = colors[Math.floor(timeRatio * colors.length)];
      resultsTable.push([
        result.file,
        result.type === 'wrong-answer' ? chalk.red('✖ Wrong answer') : chalk.green('✔ Success'),
        color(`${result.time.toFixed(3)} s`),
      ]);
      if (result.type === 'wrong-answer') {
        resultsTable.push([{
          colSpan: 3,
          content: printOutput(result, lbl),
        }]);
      }
    } else if (result.type === 'runtime-error') {
      let errorMessage = chalk.red.bold(result.message);
      if (result.stderr) errorMessage += chalk`\n\n{red ${result.stderr.trimEnd()}}`;
      resultsTable.push([
        result.file,
        chalk.red('✖ Runtime error'),
        '',
      ]);
      resultsTable.push([
        {
          colSpan: 3,
          content: errorMessage,
        },
      ]);
    } else {
      resultsTable.push([
        result.file,
        chalk.yellow('⚠ Time limit exceeded'),
        '',
      ]);
    }
  });
  if (resultsTable.length > 0) console.log(resultsTable.toString());
  if (successCount > 1) console.log(chalk.greenBright(`\n${successCount} successful tests`));
  else if (successCount === 1) console.log(chalk.greenBright('\n1 successful test'));
}

async function testDockerAvailable(runner: Runner) {
  if (!(await runner.ping())) {
    const downloadPage = 'https://docs.docker.com/engine/install/';
    console.log(chalk.red.bold('Docker is not available'));
    console.log(chalk`{cyan You can download it from: {blue.underline ${downloadPage}}}`);
    console.log(chalk.cyan('To verify your installation run:'));
    console.log(chalk.blue('docker -v'));
    const { openPage } = await Enquirer.prompt<{
      openPage: boolean
    }>([{
      name: 'openPage',
      type: 'confirm',
      message: 'Do you want to open the install page now?',
      initial: true,
    }]);
    if (openPage) await open(downloadPage, { wait: true });
    process.exit(1);
  }
}

async function testCodeExists(code: string) {
  try {
    await fse.lstat(code);
  } catch (error) {
    if (error.code === 'ENOENT') exitWithError('Code file doesn\'t exist');
    else exitWithError(error.message);
  }
}

async function getDirOverwriteMode(argv: yargs.Arguments<RunArgs>): Promise<OutputOverwriteMode> {
  if (argv.clear) return 'clear';
  if (argv.overwrite) return 'overwrite';
  const answers = await Enquirer.prompt<{
    mode: OutputOverwriteMode;
  }>([
    {
      name: 'mode',
      type: 'select',
      message: 'The output directory is not empty. What do you want to do?',
      required: true,
      choices: [
        {
          name: 'exit',
          message: 'Exit the program ',
        },
        {
          name: 'overwrite',
          message: 'Overwrite only changed files',
        },
        {
          name: 'clear',
          message: 'Remove all files and directories in output directory',
        },
      ],
    },
  ]);
  console.log();
  return answers.mode;
}

async function confirmFileOverwrite(argv: yargs.Arguments<RunArgs>): Promise<boolean> {
  if (argv.overwrite) return true;
  const answers = await Enquirer.prompt<{
    overwrite: boolean;
  }>([
    {
      name: 'overwrite',
      type: 'confirm',
      message: 'The output file already exists, and will be overwritten. Continue?',
      required: true,
    },
  ]);
  console.log();
  return answers.overwrite;
}

export async function runHandler(argv: yargs.Arguments<RunArgs>): Promise<void> {
  const code = path.resolve(process.cwd(), argv.code);
  const input = path.resolve(process.cwd(), argv.input);
  const output = path.resolve(process.cwd(), argv.output);

  await testCodeExists(code);

  const connectingSpinner = ora('Connecting to Docker daemon').start();
  const runner = new Runner();
  await testDockerAvailable(runner);
  const imagePulled = await runner.isImagePulled();
  // Start pulling before asking to overwrite
  const pullContainerImagePromise: null | Promise<void> = imagePulled ? null : runner.pullImage();
  connectingSpinner.succeed();

  let inputStats: fse.Stats;
  try {
    inputStats = await fse.lstat(input);
  } catch (error) {
    if (error.code === 'ENOENT') exitWithError('Input file or directory doesn\'t exist');
    else exitWithError(error.message);
    return;
  }

  try {
    const outputStats = await fse.lstat(output);
    if (outputStats.isDirectory()) {
      if (!inputStats.isDirectory()) exitWithError('Output is a directory, but input is a file');

      const files = await fse.readdir(output);
      if (files.length !== 0) {
        const mode = await getDirOverwriteMode(argv);
        if (mode === 'exit') process.exit(0);
        else if (mode === 'clear') await fse.emptyDir(output);
      }
    } else {
      if (inputStats.isDirectory()) exitWithError('Output is a file, but input is a directory');
      if (argv.clear) printWarning(chalk.yellow('Argument --clear can only be used with a directory output'));
      if (!await confirmFileOverwrite(argv)) process.exit(0);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      if (inputStats.isDirectory()) await fse.ensureDir(output);
    } else exitWithError(error.message);
  }

  if (!imagePulled) {
    try {
      const pullingSpinner = ora('Pulling container').start();
      await pullContainerImagePromise;
      pullingSpinner.succeed();
    } catch (error) {
      exitWithError(error.message);
    }
  }

  const startingSpinner = ora('Starting docker container').start();
  try {
    await runner.start();
    await runner.sendCode(await fse.readFile(code), path.extname(code));
    startingSpinner.succeed();

    let results: PrintableResult[];
    if (inputStats.isDirectory()) {
      const files = await globPromise(argv.pattern, { cwd: input });
      const progress = new RunProgress(files.length);
      const tests = files
        .map((file) => new Test(
          runner,
          path.resolve(input, file),
          file,
        ));
      const chunks = _.chunk(tests, argv.chunk);
      chunks.reduce(async (prev, chunk: Test[]) => {
        await prev;
        const inputs = await Promise.all(chunk.map((test) => test.getInputBuffer()));
        const containerPaths = await runner.sendInputs(inputs);
        chunk.forEach((test, index) => {
          test.setInputSent(containerPaths[index]);
        });
        progress.increaseSent(chunk.length);
      }, Promise.resolve());
      tests.reduce(async (prev, test) => {
        await prev;
        await test.waitInputSent;
        test.test(argv.time);
      }, Promise.resolve());
      results = await Promise.all(tests.map(async (test) => {
        const result = await test.waitTestCompleted;
        progress.increaseTested();
        if (result.type === 'success') {
          await test.saveOutput(path.resolve(output, replaceExt(test.inputFileRelative, '.out')));
        }
        progress.increaseDone(result.type);
        return {
          ...result,
          file: test.inputFileRelative,
        };
      }));
      progress.finish();
    } else {
      const sendSpinner = ora('Sending input').start();
      const inputContainerPath = await runner.sendInput(await fse.readFile(input));
      sendSpinner.succeed();
      const runSpinner = ora('Testing').start();
      const result = await runner.run(inputContainerPath, argv.time);
      if (result.type === 'success') {
        await fse.writeFile(output, await runner.getOutput(result.outputContainerPath));
      }
      results = [{
        ...result,
        file: path.basename(argv.input),
      }];
      runSpinner.succeed();
    }
    const stopSpinner = ora('Killing docker container').start();
    await runner.stop();
    stopSpinner.succeed();
    printResults(results, argv.time, false, argv.hideSuccess);
  } catch (error) {
    await runner.stop();
    exitWithError(error.message);
  }
}

function transformOutput(output: string): string[] {
  return eol
    .split(output.trimEnd())
    .map((line) => line.trimEnd());
}

async function getTestResult(
  result: ResultSuccess,
  file: string,
  outputFile: string,
  runner: Runner,
): Promise<PResultSuccess | PResultWrongAnswer> {
  const expectedOutput = transformOutput(await fse.readFile(outputFile, 'utf-8'));
  const outputBuff = await runner.getOutput(result.outputContainerPath);
  const output = transformOutput(outputBuff.toString('utf-8'));
  if (!_.isEqual(expectedOutput, output)) {
    return {
      type: 'wrong-answer',
      time: result.time,
      expectedOutput,
      output,
      file,
    };
  }
  return {
    type: 'success',
    time: result.time,
    file,
  };
}

export async function testHandler(argv: yargs.Arguments<TestArgs>): Promise<void> {
  const code = path.resolve(process.cwd(), argv.code);
  const input = path.resolve(process.cwd(), argv.input);
  const output = path.resolve(process.cwd(), argv.output);

  await testCodeExists(code);

  const connectingSpinner = ora('Connecting to Docker daemon').start();
  const runner = new Runner();
  await testDockerAvailable(runner);
  const imagePulled = await runner.isImagePulled();
  connectingSpinner.succeed();

  let inputStats: fse.Stats;
  let outputStats: fse.Stats;
  try {
    inputStats = await fse.lstat(input);
  } catch (error) {
    if (error.code === 'ENOENT') exitWithError('Input file or directory doesn\'t exist');
    else exitWithError(error.message);
    return;
  }
  try {
    outputStats = await fse.lstat(output);
  } catch (error) {
    if (error.code === 'ENOENT') exitWithError('Output file or directory doesn\'t exist');
    else exitWithError(error.message);
    return;
  }
  const matched: string[] = [];
  if (outputStats.isDirectory()) {
    const inputFiles = await globPromise(argv.inputPattern, { cwd: input });
    const outputFiles = await globPromise(`**${argv.outputExt}`, { cwd: output });
    const notMatched: string[] = [];
    inputFiles.forEach((inputFile) => {
      if (outputFiles.includes(replaceExt(inputFile, argv.outputExt))) {
        matched.push(inputFile);
      } else notMatched.push(inputFile);
    });
    if (notMatched.length > 0) {
      const formatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });
      const formattedList = formatter
        .formatToParts(notMatched)
        .map(({ type, value }) => (type === 'element' ? chalk.cyan(value) : value))
        .join('');
      printWarning(`Output files are missing for ${formattedList}`);
    }
    if (matched.length === 0) exitWithError('No matching files found');

    if (!inputStats.isDirectory()) exitWithError('Output is a directory, but input is a file');
  } else if (inputStats.isDirectory()) exitWithError('Output is a file, but input is a directory');

  if (!imagePulled) {
    try {
      const pullingSpinner = ora('Pulling container').start();
      await runner.pullImage();
      pullingSpinner.succeed();
    } catch (error) {
      exitWithError(error.message);
    }
  }

  const startingSpinner = ora('Starting docker container').start();
  try {
    await runner.start();
    await runner.sendCode(await fse.readFile(code), path.extname(code));
    startingSpinner.succeed();

    let results: PrintableResult[];
    if (inputStats.isDirectory()) {
      const progress = new RunProgress(matched.length);
      const tests = matched
        .map((file) => new Test(
          runner,
          path.resolve(input, file),
          file,
        ));
      const chunks = _.chunk(tests, argv.chunk);
      chunks.reduce(async (prev, chunk: Test[]) => {
        await prev;
        const inputs = await Promise.all(chunk.map((test) => test.getInputBuffer()));
        const containerPaths = await runner.sendInputs(inputs);
        chunk.forEach((test, index) => {
          test.setInputSent(containerPaths[index]);
        });
        progress.increaseSent(chunk.length);
      }, Promise.resolve());
      tests.reduce(async (prev, test) => {
        await prev;
        await test.waitInputSent;
        test.test(argv.time);
      }, Promise.resolve());
      results = await Promise.all(tests.map(async (test): Promise<PrintableResult> => {
        const result = await test.waitTestCompleted;
        progress.increaseTested();
        if (result.type === 'success') {
          const outputFileResolved = path.resolve(
            output,
            replaceExt(test.inputFileRelative, argv.outputExt),
          );
          const pResult = await getTestResult(
            result,
            test.inputFileRelative,
            outputFileResolved,
            runner,
          );
          progress.increaseDone(pResult.type);
          return pResult;
        }
        progress.increaseDone(result.type);
        return {
          ...result,
          file: test.inputFileRelative,
        };
      }));
      progress.finish();
    } else {
      const runSpinner = ora('Testing').start();
      const inputContainerPath = await runner.sendInput(await fse.readFile(input));
      const result = await runner.run(inputContainerPath, argv.time);
      const file = path.basename(argv.input);
      if (result.type === 'success') {
        results = [await getTestResult(result, file, output, runner)];
      } else {
        results = [{
          ...result,
          file,
        }];
      }
      runSpinner.succeed('Testing');
    }
    const stopSpinner = ora('Stopping docker container').start();
    await runner.stop();
    stopSpinner.succeed();
    printResults(results, argv.time, argv.lineByLine, argv.hideSuccess);
  } catch (error) {
    await runner.stop();
    exitWithError(error.message);
  }
}
