/* eslint-disable max-classes-per-file */

export class ContainerNotStartedError extends Error {
  public constructor() {
    super('Container not started');
  }
}

export class UnknownExtensionError extends Error {
  private ext: string;

  public constructor(ext: string) {
    super(`Unknown extension: ${ext}`);
    this.ext = ext;
  }
}

export class CodeNotSentError extends Error {
  public constructor() {
    super('Code not sent');
  }
}
