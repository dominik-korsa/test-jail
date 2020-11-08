import yargs from 'yargs';
import path from 'path';
import fse from 'fs-extra';
import ora from 'ora';
import chalk from 'chalk';
import replaceExt from 'replace-ext';
import Table from 'cli-table3';
import sequential from 'promise-sequential';
import Enquirer from 'enquirer';
import open from 'open';
import {
  Runner, Result, pullContainerImage, isImagePulled, isDockerAvailable,
} from '../../index';
import { globPromise } from '../../utils';

export interface RunArgs {
  url: string;
  code: string;
  input: string;
  output: string;
  time: number;
  pattern: string;
  overwrite: boolean;
  clear: boolean;
}

export type OutputOverwriteMode = 'clear' | 'overwrite' | 'exit';

function exitWithError(text: string) {
  console.error(chalk`{red {bold Error:} ${text}}`);
  process.exit(1);
}

function printWarning(text: string) {
  console.warn(chalk`{yellowBright {bold Warning:} ${text}}`);
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

  if (!(await isDockerAvailable())) {
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

  // Start pulling before asking to overwrite
  const imagePulled = await isImagePulled();
  const pullContainerImagePromise: null | Promise<void> = imagePulled ? null : pullContainerImage();

  try {
    await fse.lstat(code);
  } catch (error) {
    if (error.code === 'ENOENT') exitWithError('Code file doesn\'t exist');
    else exitWithError(error.message);
  }

  let inputStats: fse.Stats;
  try {
    inputStats = await fse.lstat(input);

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
        if (inputStats.isDirectory()) await fse.mkdir(output);
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
    const runner = new Runner();
    try {
      await runner.start();
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
          }
          if (result.type === 'runtime-error') {
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
      exitWithError(error.message);
    }
  } catch (error) {
    if (error.code === 'ENOENT') exitWithError('Input file or directory doesn\'t exist');
    else exitWithError(error.message);
  }
}
