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
