import { Command, InvalidArgumentError } from 'commander';
import { parsePorts } from './parse-args.js';
import { VALID_SIGNALS, type Signal } from './types.js';
import { runCheck } from './commands/check.js';
import { runKill } from './commands/kill.js';

function parseSignalOption(value: string): Signal {
  const upper = value.toUpperCase() as Signal;
  if (!VALID_SIGNALS.includes(upper)) {
    throw new InvalidArgumentError(
      `Unknown signal "${value}". Accepted: ${VALID_SIGNALS.join(', ')}`,
    );
  }
  return upper;
}

function parseGraceOption(value: string): number {
  const n = parseFloat(value);
  if (isNaN(n) || n < 0) {
    throw new InvalidArgumentError(`--grace must be a non-negative number, got "${value}"`);
  }
  return n;
}

const program = new Command();

program
  .name('deadport')
  .description('Kill the process holding a port. One command, zero Stack Overflow tabs.')
  .version('0.2.0-beta.1', '-V, --version')
  .argument(
    '<port...>',
    'Port(s) to target: single (3000), colon (:3000), range (3000-3010), comma list (3000,8080)',
  )
  .option('-f, --force', 'Skip the confirmation prompt')
  .option('-c, --check', 'Show what is running on the port(s), do not kill')
  .option(
    '-s, --signal <name>',
    'Initial signal (SIGTERM | SIGINT | SIGKILL | SIGHUP | SIGQUIT)',
    parseSignalOption,
    'SIGTERM' as Signal,
  )
  .option(
    '--grace <seconds>',
    'Seconds to wait for SIGTERM before escalating to SIGKILL',
    parseGraceOption,
    2,
  )
  .option('-q, --quiet', 'Minimal output (implies --force)')
  .option('-j, --json', 'JSON output (implies --quiet and --force unless --check)')
  .option('-v, --verbose', 'Show full command line and additional metadata')
  .option('--no-safety', 'Disable the extra confirmation prompt for system ports')
  .action(
    async (
      portArgs: string[],
      options: {
        force: boolean;
        check: boolean;
        signal: Signal;
        grace: number;
        quiet: boolean;
        json: boolean;
        verbose: boolean;
        safety: boolean;
      },
    ) => {
      // Apply NO_COLOR / DEADPORT_NO_SAFETY environment variables
      if (process.env['DEADPORT_NO_SAFETY']) {
        options.safety = false;
      }

      const parseResult = parsePorts(portArgs);
      if (!parseResult.ok) {
        console.error(`deadport: ${parseResult.reason}`);
        process.exit(4);
      }

      const { ports } = parseResult;

      if (options.check) {
        await runCheck(ports, {
          json: options.json,
          verbose: options.verbose,
        });
        process.exit(0);
      }

      // Kill mode
      try {
        const exitCode = await runKill(ports, {
          force: options.force || options.quiet || options.json,
          signal: options.signal,
          graceSecs: options.grace,
          quiet: options.quiet,
          json: options.json,
          safety: options.safety,
        });
        process.exit(exitCode);
      } catch (err: unknown) {
        // runKill throws "not yet implemented" in the scaffold — show a useful message.
        if (err instanceof Error && err.message.includes('not yet implemented')) {
          console.error('deadport: kill is not yet implemented in this scaffold.');
          console.error('Use --check to see what is listening on this port.');
          process.exit(5);
        }
        // Truly unexpected error
        console.error('deadport: internal error');
        if (err instanceof Error) console.error(err.message);
        process.exit(5);
      }
    },
  );

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof Error) {
    console.error(`deadport: ${err.message}`);
  }
  process.exit(4);
});
