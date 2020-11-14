import ansi from 'ansi-escapes';
import chalk from 'chalk';

export default class RunProgress {
  private buffer = '';

  private readonly total: number;

  private done = 0;

  private tested = 0;

  private sent = 0;

  private start: number = Date.now();

  private seconds = 0;

  private readonly updateIntervalId: NodeJS.Timeout;

  public constructor(total: number) {
    this.total = total;
    this.write(ansi.cursorHide);
    this.update(false);
    this.updateIntervalId = setInterval(() => { this.updateTime(); }, 100);
  }

  private updateTime() {
    const seconds = Math.floor((Date.now() - this.start) / 1000);
    if (seconds !== this.seconds) {
      this.seconds = seconds;
      this.update();
    }
  }

  public update(clear = true): void {
    if (clear) this.write(ansi.cursorLeft, ansi.eraseLines(3));
    const totalChars = 60;
    const testChars = totalChars / this.total;
    const doneChars = Math.ceil(testChars * this.done);
    const testedChars = Math.ceil(testChars * this.tested);
    const sentChars = Math.ceil(testChars * this.sent);
    const emptyChars = totalChars - sentChars;
    for (let i = 0; i < doneChars; i += 1) this.write(chalk.cyan('█'));
    for (let i = 0; i < testedChars - doneChars; i += 1) this.write(chalk.yellow('░'));
    for (let i = 0; i < sentChars - testedChars; i += 1) this.write(chalk.white('░'));
    for (let i = 0; i < emptyChars; i += 1) this.write(chalk.grey('░'));
    const saving = this.tested - this.done;
    this.write(chalk`\n\n{gray {cyan ${this.done} done} and {yellow ${saving} saving} out of {white ${this.sent}} sent and ${this.total} total}`);
    this.write(` (${Math.floor(this.seconds / 60)} min ${
      (this.seconds % 60).toLocaleString(undefined, { minimumIntegerDigits: 2 })
    } sec)`);
    this.flush();
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
    clearInterval(this.updateIntervalId);
    this.write(ansi.cursorLeft, ansi.eraseLine);
    this.write(chalk`{green √} Testing\n`);
    this.flush();
  }

  private write(...text: string[]) {
    this.buffer += text.join('');
  }

  private flush() {
    process.stdout.write(this.buffer);
    this.buffer = '';
  }
}
