import chalk from 'chalk';
import { Runner } from '../index';

export default async function ping(): Promise<void> {
  const runner = new Runner();
  const success = await runner.ping();
  if (success) {
    console.log(chalk.green('Connected successfully'));
    process.exit(0);
  } else {
    console.log(chalk.red('Failed to connect to Docker daemon'));
    process.exit(1);
  }
}
