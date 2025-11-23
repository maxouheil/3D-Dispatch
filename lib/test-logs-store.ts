// Store pour les logs de test en mémoire (partagé entre les requêtes)
interface TestLog {
  id: string;
  time: string;
  message: string;
  type?: 'log' | 'progress' | 'result' | 'complete';
  data?: any;
}

class TestLogsStore {
  private logs: Map<string, TestLog[]> = new Map();
  private currentTestId: string | null = null;

  startTest(testId: string) {
    this.currentTestId = testId;
    this.logs.set(testId, []);
  }

  addLog(message: string, type: 'log' | 'progress' | 'result' | 'complete' = 'log', data?: any) {
    if (!this.currentTestId) {
      const testId = `test-${Date.now()}`;
      this.currentTestId = testId;
      this.logs.set(testId, []);
    }
    
    const logs = this.logs.get(this.currentTestId);
    if (logs) {
      logs.push({
        id: `log-${logs.length}-${Date.now()}`,
        time: new Date().toISOString(),
        message,
        type,
        data,
      });
    }
  }

  getLogs(testId?: string): TestLog[] {
    const id = testId || this.currentTestId;
    if (!id) return [];
    return this.logs.get(id) || [];
  }

  clearLogs(testId?: string) {
    const id = testId || this.currentTestId;
    if (id) {
      this.logs.delete(id);
    }
  }

  getCurrentTestId(): string | null {
    return this.currentTestId;
  }

  endTest() {
    this.currentTestId = null;
  }
}

export const testLogsStore = new TestLogsStore();

