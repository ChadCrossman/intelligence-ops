declare module "node-cron" {
  export interface ScheduledTask {
    start(): void;
    stop(): void;
  }

  interface NodeCron {
    schedule(expression: string, task: () => void | Promise<void>): ScheduledTask;
  }

  const cron: NodeCron;
  export default cron;
}
