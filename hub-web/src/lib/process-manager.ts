// We keep track of processes in memory to allow cancellation
export const runningProcesses = new Map<string, any>();

// Function to kill process if cancelled
export function killTaskProcess(taskId: string) {
  const child = runningProcesses.get(taskId);
  if (child) {
    try {
       child.kill('SIGKILL');
    } catch(e) {}
    runningProcesses.delete(taskId);
  }
}
