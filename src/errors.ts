/* eslint-disable max-classes-per-file */

export class ContainerNotStartedError extends Error {
  constructor() {
    super('Container not started');
  }
}

export class UnknownExtensionError extends Error {
  private ext: string;

  constructor(ext: string) {
    super(`Unknown extension: ${ext}`);
    this.ext = ext;
  }
}

export class CodeNotSentError extends Error {
  constructor() {
    super('Code not sent');
  }
}
