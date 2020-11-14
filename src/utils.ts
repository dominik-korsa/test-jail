import util from 'util';
import cp from 'child_process';
import glob from 'glob';

export const execPromise = util.promisify(cp.exec);

export const globPromise = util.promisify(glob);

export function execWithInput(command: string, input: string): Promise<{
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const childProcess = cp.exec(
      command,
      async (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve({ stdout, stderr });
      },
    );
    childProcess.stdin?.end(input);
  });
}

export function b64encode(data: string): string {
  return Buffer.from(data, 'utf-8').toString('base64');
}

export function b64decode(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}
