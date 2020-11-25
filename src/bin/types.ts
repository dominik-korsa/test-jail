export interface RunArgs {
  url: string;
  code: string;
  input: string;
  output: string;
  time: number;
  pattern: string;
  overwrite: boolean;
  clear: boolean;
  hideSuccess: boolean;
  chunk: number;
}

export interface TestArgs {
  url: string;
  code: string;
  input: string;
  output: string;
  time: number;
  inputPattern: string;
  outputExt: string;
  lineByLine: boolean;
  hideSuccess: boolean;
  chunk: number;
}

export type OutputOverwriteMode = 'clear' | 'overwrite' | 'exit';

export interface PResultSuccess {
  type: 'success';
  time: number;
  file: string;
}

export interface PResultWrongAnswer {
  type: 'wrong-answer';
  time: number;
  file: string;
  output: string;
  expectedOutput: string;
}

export interface PResultRuntimeError {
  type: 'runtime-error';
  message: string;
  stderr?: string;
  file: string;
}

export interface PResultTimeout {
  type: 'timeout';
  file: string;
}

export type PrintableResult = PResultSuccess
  | PResultWrongAnswer
  | PResultRuntimeError
  | PResultTimeout;

export type PrintableResultType = PrintableResult['type'];

export interface NotChangedChunk {
  changed: false;
  output: string[];
}

export interface ChangedChunk {
  changed: true;
  expectedOutput: string[];
  output: string[];
}

export type Chunk = NotChangedChunk | ChangedChunk;
