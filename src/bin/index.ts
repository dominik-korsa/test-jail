#!/usr/bin/env node
import yargs from 'yargs';
import fs from 'fs';
import path from "path";
import {createRunner, Result} from "../index";
import ora from 'ora';
import chalk from "chalk";
import replaceExt from 'replace-ext';
import Table from 'cli-table3';
import glob from 'glob';
import util from "util";

const globPromise = util.promisify(glob);

interface RunArgs {
    url: string;
    code: string;
    input: string;
    output: string;
    time: number;
    pattern: string;
}

yargs
    .scriptName('awesome-test-runner')
    .usage('$0 <cmd> [args]')
    .command<RunArgs>('run <code>', '', (commandYargs) => {
        commandYargs.positional('code', {
            type: 'string',
        });
        commandYargs.option('i', {
            alias: 'input',
            type: 'string',
            demandOption: true,
            describe: 'Path to input file or directory of input files',
        });
        commandYargs.option('o', {
            alias: 'output',
            type: 'string',
            demandOption: true,
            describe: 'Path where output file or directory of output files will be created',
        });
        commandYargs.option('t', {
            alias: 'time',
            type: 'number',
            default: 30,
            describe: 'Time limit in seconds'
        })
        commandYargs.option('pattern', {
            type: 'string',
            default: '**.in',
            describe: 'Glob pattern to select files in input directory. Matches all .in files by default. Does not apply if input is a single file.',
        })
    }, runHandler)
    .demandCommand()
    .help()
    .strict()
    .argv;

async function runHandler(argv: yargs.Arguments<RunArgs>) {
    const code = path.resolve(process.cwd(), argv.code);
    const input = path.resolve(process.cwd(), argv.input);
    const output = path.resolve(process.cwd(), argv.output);

    try {
        await fs.promises.lstat(code);
    } catch (error) {
        if (error.code === 'ENOENT') console.error('Code file doesn\'t exist')
        else console.error(error);
        process.exit(1);
    }

    let inputStats: fs.Stats;
    try {
        inputStats = await fs.promises.lstat(input);
    } catch (error) {
        if (error.code === 'ENOENT') console.error('Input file or directory doesn\'t exist')
        else console.error(error);
        process.exit(1);
    }

    try {
        const outputStats = await fs.promises.lstat(output);
        if (outputStats.isDirectory()) {
            if (!inputStats.isDirectory()) {
                console.error('Output is a directory, but input is a file');
                process.exit(1);
            }
        } else if (inputStats.isDirectory()) {
            console.error('Output is a file, but input is a directory');
            process.exit(1);
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            if (inputStats.isDirectory()) await fs.promises.mkdir(output);
        } else {
            console.error(error);
            process.exit(1);
        }
    }

    const startingSpinner = ora('Starting docker container').start();
    const runner = await createRunner(code);
    startingSpinner.succeed();

    const results: (Result & {
        file: string;
    })[] = [];
    const runSpinner = ora('Testing').start();
    if (inputStats.isDirectory()) {
        const files = await globPromise(argv.pattern, {cwd: input});
        for (const file of files) {
            runSpinner.text = `Testing ${chalk.cyan(file)}`;
            const result = await runner.testInputFile(path.resolve(input, file), argv.time);
            if (result.type === 'success') {
                await fs.promises.writeFile(
                    path.resolve(output, replaceExt(file, '.out')),
                    result.output,
                    'utf8'
                );
            }
            results.push({
                ...result,
                file,
            });
        }
    } else {
        const result = await runner.testInputFile(input, argv.time);
        if (result.type === 'success') {
            await fs.promises.writeFile(
                output,
                result.output,
                'utf8'
            );
        }
        results.push({
            ...result,
            file: path.basename(argv.input),
        });
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
            head: ['cyan']
        }
    })
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
        })
    )
    console.log(resultsTable.toString())
}
