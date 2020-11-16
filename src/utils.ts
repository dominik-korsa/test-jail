import util from 'util';
import cp from 'child_process';
import glob from 'glob';
import tar from 'tar-stream';

export const execPromise = util.promisify(cp.exec);

export const globPromise = util.promisify(glob);

export const sleep = util.promisify(setTimeout);

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

export async function packTar(headers: tar.Headers, data: string | Buffer): Promise<tar.Pack> {
  const pack = tar.pack();
  await new Promise((resolve, reject) => {
    pack.entry(headers, data, ((err) => {
      if (err) reject(err); else resolve();
    }));
  });
  pack.finalize();
  return pack;
}
