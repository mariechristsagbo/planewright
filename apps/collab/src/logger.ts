export type LogFields = Readonly<Record<string, unknown>>;

export type Logger = (event: string, fields?: LogFields) => void;

/** Writes one JSON object per line to stdout so log collectors can parse events. */
export const jsonLogger: Logger = (event, fields = {}) => {
  process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), event, ...fields })}\n`);
};

export const silentLogger: Logger = () => undefined;
