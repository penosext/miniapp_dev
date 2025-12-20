import { reactive, toRefs, onMounted } from 'vue';
import { showToast } from '@didi/mini-apps-common';

// 导入 Shell JS API 模块
const ShellModule = require('shell');

interface TerminalHistory {
  type: 'command' | 'output' | 'error';
  content: string;
  timestamp: number;
}

interface TerminalState {
  inputCommand: string;
  history: TerminalHistory[];
  isExecuting: boolean;
  shellModule: any;
  currentDir: string;
  outputRef: HTMLElement | null;
}

export default {
  setup() {
    const state = reactive<TerminalState>({
      inputCommand: '',
      history: [
        {
          type: 'output',
          content: '欢迎使用终端\n输入 "help" 查看可用命令\n',
          timestamp: Date.now()
        },
        {
          type: 'output',
          content: '提示：按↑↓键可以浏览历史命令',
          timestamp: Date.now()
        }
      ],
      isExecuting: false,
      shellModule: null,
      currentDir: '~',
      outputRef: null
    });

    // 命令历史记录（用于↑↓键浏览）
    const commandHistory: string[] = [];
    let historyIndex = -1;

    // 初始化 Shell
    const initShell = async () => {
      try {
        state.shellModule = ShellModule;
        await state.shellModule.initialize();
        state.history.push({
          type: 'output',
          content: '✓ Shell 初始化成功\n',
          timestamp: Date.now()
        });
      } catch (error: any) {
        state.history.push({
          type: 'error',
          content: `✗ Shell 初始化失败: ${error.message || '未知错误'}\n`,
          timestamp: Date.now()
        });
      }
    };

    // 执行命令
    const executeCommand = async () => {
      if (!state.inputCommand.trim() || state.isExecuting) return;

      const command = state.inputCommand.trim();
      
      // 记录命令
      state.history.push({
        type: 'command',
        content: `${state.currentDir} $ ${command}`,
        timestamp: Date.now()
      });

      // 添加到命令历史
      if (commandHistory[commandHistory.length - 1] !== command) {
        commandHistory.push(command);
      }
      historyIndex = commandHistory.length;
      state.inputCommand = '';

      // 处理特殊命令
      if (await handleBuiltinCommands(command)) {
        scrollToBottom();
        return;
      }

      // 执行系统命令
      state.isExecuting = true;
      try {
        if (!state.shellModule) {
          throw new Error('Shell 模块未初始化');
        }

        const result = await state.shellModule.exec(command);
        
        state.history.push({
          type: 'output',
          content: result || '(无输出)\n',
          timestamp: Date.now()
        });
        
      } catch (error: any) {
        state.history.push({
          type: 'error',
          content: `错误: ${error.message || '命令执行失败'}\n`,
          timestamp: Date.now()
        });
      } finally {
        state.isExecuting = false;
        scrollToBottom();
      }
    };

    // 处理内置命令
    const handleBuiltinCommands = async (command: string): Promise<boolean> => {
      const [cmd, ...args] = command.split(' ');
      
      switch (cmd.toLowerCase()) {
        case 'help':
          showHelp();
          return true;
          
        case 'clear':
          clearTerminal();
          return true;
          
        case 'echo':
          state.history.push({
            type: 'output',
            content: args.join(' ') + '\n',
            timestamp: Date.now()
          });
          return true;
          
        case 'pwd':
          state.history.push({
            type: 'output',
            content: state.currentDir + '\n',
            timestamp: Date.now()
          });
          return true;
          
        case 'cd':
          if (args[0] === '~') {
            state.currentDir = '~';
          } else if (args[0]) {
            state.currentDir = args[0];
          }
          state.history.push({
            type: 'output',
            content: `当前目录: ${state.currentDir}\n`,
            timestamp: Date.now()
          });
          return true;
          
        case 'history':
          state.history.push({
            type: 'output',
            content: commandHistory.map((cmd, idx) => `${idx + 1}. ${cmd}`).join('\n') + '\n',
            timestamp: Date.now()
          });
          return true;
          
        case 'date':
          state.history.push({
            type: 'output',
            content: new Date().toString() + '\n',
            timestamp: Date.now()
          });
          return true;
          
        default:
          return false;
      }
    };

    // 显示帮助
    const showHelp = () => {
      const helpText = `
可用命令：
  help              - 显示此帮助信息
  clear             - 清屏
  echo [文本]       - 显示文本
  pwd               - 显示当前目录
  cd [目录]         - 切换目录
  ls                - 列出文件
  cat [文件]        - 查看文件内容
  ps                - 查看进程
  date              - 显示日期时间
  history           - 显示命令历史
  exit              - 退出（可选）

系统命令示例：
  ls -la            - 详细列出文件
  cat /proc/cpuinfo - 查看CPU信息
  ps aux            - 查看所有进程
  df -h             - 查看磁盘使用
  free -m           - 查看内存使用
  uname -a          - 查看系统信息
`;
      state.history.push({
        type: 'output',
        content: helpText,
        timestamp: Date.now()
      });
    };

    // 清屏
    const clearTerminal = () => {
      state.history = [];
    };

    // 滚动到底部
    const scrollToBottom = () => {
      setTimeout(() => {
        if (state.outputRef) {
          state.outputRef.scrollTop = state.outputRef.scrollHeight;
        }
      }, 100);
    };

    // 键盘事件处理
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          executeCommand();
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          if (commandHistory.length > 0) {
            if (historyIndex > 0) historyIndex--;
            if (historyIndex >= 0) {
              state.inputCommand = commandHistory[historyIndex];
            }
          }
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            state.inputCommand = commandHistory[historyIndex];
          } else if (historyIndex === commandHistory.length - 1) {
            historyIndex++;
            state.inputCommand = '';
          }
          break;
      }
    };

    // 获取样式类
    const getHistoryClass = (item: TerminalHistory) => {
      switch (item.type) {
        case 'command': return 'command-line';
        case 'output': return 'output-line';
        case 'error': return 'error-line';
        default: return '';
      }
    };

    onMounted(() => {
      initShell();
      
      // 聚焦到输入框
      const input = document.querySelector('.cmd-input') as HTMLInputElement;
      if (input) {
        input.focus();
      }
    });

    return {
      ...toRefs(state),
      executeCommand,
      clearTerminal,
      handleKeyDown,
      getHistoryClass,
      scrollToBottom
    };
  }
};