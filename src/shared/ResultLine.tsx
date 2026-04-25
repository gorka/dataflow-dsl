import type { ExecutionResult } from '../types';

export function ResultLine({ result, className, successClass, errorClass, runningClass, skippedClass }: {
  result?: ExecutionResult;
  className?: string;
  successClass?: string;
  errorClass?: string;
  runningClass?: string;
  skippedClass?: string;
}) {
  if (!result) return null;
  if (result.status === 'skipped') return <div className={`${className} ${skippedClass}`}>disconnected</div>;
  if (result.status === 'running') return <div className={`${className} ${runningClass}`}>running...</div>;
  if (result.status === 'error') return <div className={`${className} ${errorClass}`}>{result.error}</div>;
  if (result.status === 'success') {
    const count = result.data?.items.length ?? 0;
    const ms = result.durationMs ?? 0;
    return <div className={`${className} ${successClass}`}>{count} items · {ms}ms</div>;
  }
  return null;
}
