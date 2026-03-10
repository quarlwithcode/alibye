/**
 * ⏱️ alibye — Error Classes
 */

export class AlibyeError extends Error {
  constructor(message: string) { super(message); this.name = 'AlibyeError'; }
}

export class TimerAlreadyRunningError extends AlibyeError {
  constructor(description: string) {
    super(`Timer already running: "${description}". Stop it first with: alibye stop`);
    this.name = 'TimerAlreadyRunningError';
  }
}

export class NoActiveTimerError extends AlibyeError {
  constructor() {
    super('No timer running. Start one with: alibye start');
    this.name = 'NoActiveTimerError';
  }
}

export class ProjectNotFoundError extends AlibyeError {
  constructor(identifier: string) {
    super(`Project not found: ${identifier}`);
    this.name = 'ProjectNotFoundError';
  }
}

export class ClientNotFoundError extends AlibyeError {
  constructor(identifier: string) {
    super(`Client not found: ${identifier}`);
    this.name = 'ClientNotFoundError';
  }
}

export class EntryNotFoundError extends AlibyeError {
  constructor(identifier: string) {
    super(`Time entry not found: ${identifier}`);
    this.name = 'EntryNotFoundError';
  }
}

export class InvalidDateRangeError extends AlibyeError {
  constructor(from: string, to: string) {
    super(`Invalid date range: ${from} to ${to}`);
    this.name = 'InvalidDateRangeError';
  }
}

export class TaskNotFoundError extends AlibyeError {
  constructor(identifier: string) {
    super(`Task not found: ${identifier}`);
    this.name = 'TaskNotFoundError';
  }
}

export class WorkTypeNotFoundError extends AlibyeError {
  constructor(identifier: string) {
    super(`Work type not found: ${identifier}`);
    this.name = 'WorkTypeNotFoundError';
  }
}
