import chalk from 'chalk';

type LogLevel = 'log' | 'info' | 'warn' | 'error';

interface Logger {
    log: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
}

const formatTimestamp = (): string => {
    const now = new Date();
    return now.toISOString();
};

const formatMessage = (level: LogLevel, message: string): string => {
    const timestamp = formatTimestamp();
    const coloredLevel = {
        log: chalk.gray('[LOG]'),
        info: chalk.blue('[INFO]'),
        warn: chalk.yellow('[WARN]'),
        error: chalk.red('[ERROR]'),
    }[level];

    return `${chalk.dim(timestamp)} ${coloredLevel} ${message}`;
};

export const logger: Logger = {
    log: (message: string, ...args: unknown[]): void => {
        console.log(formatMessage('log', message), ...args);
    },
    info: (message: string, ...args: unknown[]): void => {
        console.info(formatMessage('info', message), ...args);
    },
    warn: (message: string, ...args: unknown[]): void => {
        console.warn(formatMessage('warn', message), ...args);
    },
    error: (message: string, ...args: unknown[]): void => {
        console.error(formatMessage('error', message), ...args);
    },
};

export default logger;
