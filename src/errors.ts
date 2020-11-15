/* eslint-disable max-classes-per-file */

export class ContainerNotStartedError extends Error {
  public constructor() {
    super('Container not started');
  }
}

export class CodeNotSentError extends Error {
  public constructor() {
    super('Code not sent');
  }
}
