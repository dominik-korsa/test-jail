import ansi from 'ansi-escapes';
import chalk from 'chalk';
import { PrintableResultType } from './types';

export default class RunProgress {
  private buffer = '';

  private readonly total: number;

  private done = 0;

  private tested = 0;

  private sent = 0;

  private start: number = Date.now();

  private seconds = 0;

  private readonly updateIntervalId: NodeJS.Timeout;

  private results: Partial<Record<PrintableResultType, number>> = {};

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
    if (clear) this.write(ansi.cursorLeft, ansi.eraseLines(4));
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
    this.writeResults();
    this.flush();
  }

  public increaseDone(type: PrintableResultType): void {
    this.results[type] = (this.results[type] ?? 0) + 1;
    this.done += 1;
    this.update();
  }

  public increaseTested(count = 1): void {
    this.tested += count;
    this.update();
  }

  public increaseSent(count = 1): void {
    this.sent += count;
    this.update();
  }

  public finish(): void {
    clearInterval(this.updateIntervalId);
    this.write(ansi.cursorLeft, ansi.eraseLines(4));
    this.write(chalk`{green √} Testing\n`);
    this.flush();
  }

  private writeResults() {
    const formatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });
    const itemsList: string[] = [];
    if (this.results.success) itemsList.push(chalk.greenBright(`${this.results.success} success`));
    if (this.results.timeout) itemsList.push(chalk.yellowBright(`${this.results.timeout} timeout`));
    if (this.results['wrong-answer']) itemsList.push(chalk.redBright(`${this.results['wrong-answer']} wrong answer`));
    if (this.results['runtime-error']) itemsList.push(chalk.redBright(`${this.results['runtime-error']} runtime error`));
    const formattedList = formatter.format(itemsList);
    this.write('\n', formattedList);
  }

  private write(...text: string[]) {
    this.buffer += text.join('');
  }

  private flush() {
    process.stdout.write(this.buffer);
    this.buffer = '';
  }
}
