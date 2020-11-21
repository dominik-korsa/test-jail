import util from 'util';
import glob from 'glob';
import tar from 'tar-stream';
import Stream from 'stream';
import _ from 'lodash';

export const globPromise = util.promisify(glob);

export const sleep = util.promisify(setTimeout);

export function b64encode(data: string): string {
  return Buffer.from(data, 'utf-8').toString('base64');
}

export function b64decode(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

export interface File {
  name: string;
  data: string | Buffer;
}

export function packTar(...files: File[]): Stream.Readable {
  const pack = tar.pack();
  _.initial(files).forEach((file) => {
    pack.entry({
      type: 'file',
      name: file.name,
    }, file.data);
  });
  const lastFile = _.last(files);
  if (!lastFile) {
    pack.finalize();
  } else {
    pack.entry({
      type: 'file',
      name: lastFile.name,
    }, lastFile.data, () => {
      pack.finalize();
    });
  }
  return pack;
}

export async function extractTar(pack: NodeJS.ReadableStream, name: string): Promise<Buffer> {
  const extract = tar.extract();
  let chunks: Buffer[] | null = null;
  await new Promise((resolve) => {
    extract.on('entry', ((headers, stream, next) => {
      if (headers.name === name) {
        chunks = [];
        stream.on('data', (chunk: Buffer) => chunks?.push(chunk));
      }
      stream.once('end', () => next());
      stream.resume();
    }));
    extract.once('finish', () => resolve());
    pack.pipe(extract);
  });
  if (chunks === null) throw new Error('Specified file not found in tar archive');
  return Buffer.concat(chunks);
}
