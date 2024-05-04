import { EventEmitter, once } from 'node:events';

type Events = Record<string, any[]>;

/**
 * TypeScript version of events.once():
 *   https://nodejs.org/api/events.html#eventsonceemitter-name-options
 */
export async function enhancedOnce<E extends Events = Events>(
  emmiter: EventEmitter<E>,
  eventName: keyof E & string,
  options?: any
): Promise<any[]> {
  return once(emmiter, eventName, options);
}