#!/usr/bin/env node
import yargs from 'yargs';
import {
 RunArgs, runHandler, TestArgs, testHandler,
} from './handlers';

yargs
  .scriptName('test-jail')
  .usage('$0 <command> [arguments]')
  .command<RunArgs>(
    'run <code>',
    '',
    (commandYargs) => {
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
        describe: 'Time limit in seconds',
      });
      commandYargs.option('pattern', {
        type: 'string',
        default: '**.in',
        describe: 'Glob pattern to select files in input directory. Does not apply if input is a single file',
      });
      commandYargs.option('overwrite', {
        type: 'boolean',
        describe: 'Overwrite files in output folder',
      });
      commandYargs.option('clear', {
        type: 'boolean',
        describe: 'Remove all files in output directory',
      });
      commandYargs.conflicts('clear', 'overwrite');
    },
    runHandler,
  )
  .command<TestArgs>(
    'test <code>',
    '',
    (commandYargs) => {
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
        describe: 'Path to output file or directory of output files',
      });
      commandYargs.option('t', {
        alias: 'time',
        type: 'number',
        default: 30,
        describe: 'Time limit in seconds',
      });
      commandYargs.option('inputPattern', {
        type: 'string',
        default: '**.in',
        describe: 'Glob pattern to select files in input directory. Does not apply if input is a single file',
      });
      commandYargs.option('outputExt', {
        type: 'string',
        default: '.out',
        describe: 'Extension of output files. Does not apply if output is a single file',
      });
      commandYargs.option('lineByLine', {
        alias: 'lbl',
        type: 'boolean',
        describe: 'Compare expected and actual output line by line, instead of using jsdiff',
      });
    },
    testHandler,
  )
  .demandCommand()
  .help()
  .strict()
  .parse();
