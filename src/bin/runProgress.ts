import ansi from 'ansi';

export default class RunProgress {
  private readonly cursor = ansi(process.stdout);

  private readonly total: number;

  private done = 0;

  private tested = 0;

  private sent = 0;

  public constructor(total: number) {
    this.total = total;
    this.cursor.hide();
    this.update();
  }

  public update(): void {
    this.cursor.horizontalAbsolute().eraseLine();
    const totalChars = 50;
    const testChars = totalChars / this.total;
    const doneChars = Math.ceil(testChars * this.done);
    const testedChars = Math.ceil(testChars * this.tested);
    const sentChars = Math.ceil(testChars * this.sent);
    const emptyChars = totalChars - sentChars;
    this.cursor.cyan();
    for (let i = 0; i < doneChars; i += 1) this.cursor.write('█');
    this.cursor.yellow();
    for (let i = 0; i < testedChars - doneChars; i += 1) this.cursor.write('░');
    this.cursor.white();
    for (let i = 0; i < sentChars - testedChars; i += 1) this.cursor.write('░');
    this.cursor.grey();
    for (let i = 0; i < emptyChars; i += 1) this.cursor.write('░');
    this.cursor.write(' ');
    this.cursor.cyan().write(`${this.done} done`);
    this.cursor.grey().write(' and ');
    this.cursor.yellow().write(`${this.tested - this.done} saving`);
    this.cursor.grey().write(' out of ');
    this.cursor.white().write(`${this.sent} sent`);
    this.cursor.grey().write(` and ${this.total} total`);
    this.cursor.flush();
  }

  public increaseDone(): void {
    this.done += 1;
    this.update();
  }

  public increaseTested(): void {
    this.tested += 1;
    this.update();
  }

  public increaseSent(): void {
    this.sent += 1;
    this.update();
  }

  public finish(): void {
    this.cursor.horizontalAbsolute().eraseLine();
    this.cursor.green();
    this.cursor.write('√');
    this.cursor.reset();
    this.cursor.write(' Testing\n');
    this.cursor.flush();
  }
}
