import yargs from 'yargs';
import path from 'path';
import fse from 'fs-extra';
import ora from 'ora';
import chalk from 'chalk';
import replaceExt from 'replace-ext';
import Table from 'cli-table3';
import sequential from 'promise-sequential';
import Enquirer from 'enquirer';
import { Runner, Result, pullContainerImage } from '../../index';
import { globPromise } from '../../utils';

export interface RunArgs {
  url: string;
  code: string;
  input: string;
  output: string;
  time: number;
  pattern: string;
}

export type OutputOverwriteMode = 'clear' | 'overwrite' | 'exit';

async function getDirectoryOutputOverwriteMode(): Promise<OutputOverwriteMode> {
  const answers = await Enquirer.prompt<{
    mode: OutputOverwriteMode;
  }>([
    {
      name: 'mode',
      type: 'select',
      message: 'The output directory is not empty. What do you want to do?',
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

async function confirmFileOutputOverwrite(): Promise<boolean> {
  const answers = await Enquirer.prompt<{
    overwrite: boolean;
  }>([
    {
      name: 'overwrite',
      type: 'confirm',
      message: 'The output file already exists, and will be overwritten. Continue?',
    },
  ]);
  console.log();
  return answers.overwrite;
}

export async function runHandler(argv: yargs.Arguments<RunArgs>): Promise<void> {
  const code = path.resolve(process.cwd(), argv.code);
  const input = path.resolve(process.cwd(), argv.input);
  const output = path.resolve(process.cwd(), argv.output);

  // Start pulling before asking to overwrite
  const pullContainerImagePromise = pullContainerImage();

  try {
    await fse.lstat(code);
  } catch (error) {
    if (error.code === 'ENOENT') console.error('Code file doesn\'t exist');
    else console.error(error);
    process.exit(1);
  }

  let inputStats: fse.Stats;
  try {
    inputStats = await fse.lstat(input);
  } catch (error) {
    if (error.code === 'ENOENT') console.error('Input file or directory doesn\'t exist');
    else console.error(error);
    process.exit(1);
  }

  try {
    const outputStats = await fse.lstat(output);
    if (outputStats.isDirectory()) {
      if (!inputStats.isDirectory()) {
        console.error('Output is a directory, but input is a file');
        process.exit(1);
      }

      const files = await fse.readdir(output);
      if (files.length !== 0) {
        const mode = await getDirectoryOutputOverwriteMode();
        if (mode === 'exit') process.exit(0);
        else if (mode === 'clear') await fse.emptyDir(output);
      }
    } else {
      if (inputStats.isDirectory()) {
        console.error('Output is a file, but input is a directory');
        process.exit(1);
      }
      if (!await confirmFileOutputOverwrite()) process.exit(0);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      if (inputStats.isDirectory()) await fse.mkdir(output);
    } else {
      console.error(error);
      process.exit(1);
    }
  }

  const pullingSpinner = ora('Pulling container').start();
  const { upToDate } = await pullContainerImagePromise;
  if (upToDate) pullingSpinner.info(`Pulling container: ${chalk.blue('Already up to date')}`);
  else pullingSpinner.succeed();

  const startingSpinner = ora('Starting docker container').start();
  const runner = new Runner();
  await runner.start();
  try {
    await runner.sendCodeFile(code);
    startingSpinner.succeed();

    let results: (Result & {
      file: string;
    })[];
    const runSpinner = ora('Testing').start();
    if (inputStats.isDirectory()) {
      const files = await globPromise(argv.pattern, { cwd: input });
      results = await sequential(files.map((file) => async () => {
        runSpinner.text = `Testing ${chalk.cyan(file)}`;
        const result = await runner.testInputFile(path.resolve(input, file), argv.time);
        if (result.type === 'success') {
          await fse.writeFile(
            path.resolve(output, replaceExt(file, '.out')),
            result.output,
            'utf8',
          );
        }
        return {
          ...result,
          file,
        };
      }));
    } else {
      const result = await runner.testInputFile(input, argv.time);
      if (result.type === 'success') {
        await fse.writeFile(
          output,
          result.output,
          'utf8',
        );
      }
      results = [{
        ...result,
        file: path.basename(argv.input),
      }];
    }
    runSpinner.succeed('Testing');
    const stopSpinner = ora('Killing docker container').start();
    await runner.kill();
    stopSpinner.succeed();
    const resultsTable = new Table({
      head: [
        'File',
        'Status',
        'Execution time',
        'Error message',
      ],
      style: {
        head: ['cyan'],
      },
    });
    resultsTable.push(
      ...results.map((result) => {
        if (result.type === 'success') {
          const timeRatio = Math.min(result.time / argv.time, 0.999);
          const colors = [chalk.gray, chalk.white, chalk.yellow, chalk.red];
          const color = colors[Math.floor(timeRatio * colors.length)];
          return [
            result.file,
            chalk.green('✔ Success'),
            color(`${result.time.toFixed(3)} s`),
            '',
          ];
        } if (result.type === 'runtime-error') {
          return [
            result.file,
            chalk.red('✖ Runtime error'),
            '',
            result.message,
          ];
        }
        return [
          result.file,
          chalk.yellow('⚠ Time limit exceeded'),
          '',
          '',
        ];
      }),
    );
    console.log(resultsTable.toString());
  } catch (error) {
    await runner.kill();
    throw error;
  }
}
