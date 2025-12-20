// Copyright (C) 2025 Langning Chen
// 
// This file is part of miniapp.
// 
// miniapp is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// miniapp is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with miniapp.  If not, see <https://www.gnu.org/licenses/>.

import { defineComponent } from 'vue';
import { showError, showSuccess } from '../../components/ToastMessage';
import { hideLoading, showLoading } from '../../components/Loading';
import { openSoftKeyboard } from '../../utils/softKeyboardUtils';

export type shellOptions = {};

// 导入 Shell JS API 模块
const ShellModule = require('shell');

interface TerminalHistory {
  type: 'command' | 'output' | 'error';
  content: string;
  timestamp: number;
}

const shell = defineComponent({
  data() {
    return {
      $page: {} as FalconPage<shellOptions>,
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
      ] as TerminalHistory[],
      isExecuting: false,
      shellModule: null as any,
      currentDir: '~',
      commandHistory: [] as string[],
      historyIndex: -1,
      
      // 快速命令
      quickCommands: [
        { label: 'ls', command: 'ls -la' },
        { label: 'pwd', command: 'pwd' },
        { label: 'date', command: 'date' },
        { label: 'ps', command: 'ps aux' },
        { label: '网络', command: 'ping -c 3 8.8.8.8' },
        { label: '磁盘', command: 'df -h' },
        { label: '内存', command: 'free -m' },
        { label: '系统', command: 'uname -a' },
        { label: '清屏', command: 'clear' }
      ]
    };
  },

  mounted() {
    this.initShell();
  },

  methods: {
    // 初始化 Shell
    async initShell() {
      try {
        this.shellModule = ShellModule;
        await this.shellModule.initialize();
        this.addOutput('✓ Shell 初始化成功\n');
      } catch (error: any) {
        this.addError(`✗ Shell 初始化失败: ${error.message || '未知错误'}\n`);
      }
    },

    // 添加输出
    addOutput(content: string) {
      this.history.push({
        type: 'output',
        content,
        timestamp: Date.now()
      });
      this.scrollToBottom();
    },

    // 添加错误
    addError(content: string) {
      this.history.push({
        type: 'error',
        content,
        timestamp: Date.now()
      });
      this.scrollToBottom();
    },

    // 执行命令
    async executeCommand() {
      if (!this.inputCommand.trim() || this.isExecuting) return;

      const command = this.inputCommand.trim();
      
      // 记录命令
      this.history.push({
        type: 'command',
        content: `${this.currentDir} $ ${command}`,
        timestamp: Date.now()
      });

      // 添加到命令历史
      if (this.commandHistory[this.commandHistory.length - 1] !== command) {
        this.commandHistory.push(command);
      }
      this.historyIndex = this.commandHistory.length;
      this.inputCommand = '';

      // 处理特殊命令
      if (await this.handleBuiltinCommands(command)) {
        this.scrollToBottom();
        return;
      }

      // 执行系统命令
      this.isExecuting = true;
      try {
        if (!this.shellModule) {
          throw new Error('Shell 模块未初始化');
        }

        const result = await this.shellModule.exec(command);
        
        this.addOutput(result || '(无输出)\n');
        
      } catch (error: any) {
        this.addError(`错误: ${error.message || '命令执行失败'}\n`);
      } finally {
        this.isExecuting = false;
        this.scrollToBottom();
      }
    },

    // 处理内置命令
    async handleBuiltinCommands(command: string): Promise<boolean> {
      const [cmd, ...args] = command.split(' ');
      
      switch (cmd.toLowerCase()) {
        case 'help':
          this.showHelp();
          return true;
          
        case 'clear':
          this.clearTerminal();
          return true;
          
        case 'echo':
          this.addOutput(args.join(' ') + '\n');
          return true;
          
        case 'pwd':
          this.addOutput(this.currentDir + '\n');
          return true;
          
        case 'cd':
          if (args[0] === '~') {
            this.currentDir = '~';
          } else if (args[0]) {
            this.currentDir = args[0];
          }
          this.addOutput(`当前目录: ${this.currentDir}\n`);
          return true;
          
        case 'history':
          this.addOutput(this.commandHistory.map((cmd, idx) => `${idx + 1}. ${cmd}`).join('\n') + '\n');
          return true;
          
        case 'date':
          this.addOutput(new Date().toString() + '\n');
          return true;
          
        case 'exit':
          this.$page.finish();
          return true;
          
        default:
          return false;
      }
    },

    // 显示帮助
    showHelp() {
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
  exit              - 退出终端

系统命令示例：
  ls -la            - 详细列出文件
  cat /proc/cpuinfo - 查看CPU信息
  ps aux            - 查看所有进程
  df -h             - 查看磁盘使用
  free -m           - 查看内存使用
  uname -a          - 查看系统信息
  ping -c 3 8.8.8.8 - 测试网络
`;
      this.addOutput(helpText);
    },

    // 清屏
    clearTerminal() {
      this.history = [];
      this.commandHistory = [];
      this.historyIndex = -1;
    },

    // 滚动到底部
    scrollToBottom() {
      this.$nextTick(() => {
        const scroller = this.$refs.scroller as any;
        if (scroller && scroller.scrollTo) {
          scroller.scrollTo({
            x: 0,
            y: 99999,
            animated: true
          });
        }
      });
    },

    // 键盘事件处理
    handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          this.executeCommand();
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          if (this.commandHistory.length > 0) {
            if (this.historyIndex > 0) this.historyIndex--;
            if (this.historyIndex >= 0) {
              this.inputCommand = this.commandHistory[this.historyIndex];
            }
          }
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          if (this.historyIndex < this.commandHistory.length - 1) {
            this.historyIndex++;
            this.inputCommand = this.commandHistory[this.historyIndex];
          } else if (this.historyIndex === this.commandHistory.length - 1) {
            this.historyIndex++;
            this.inputCommand = '';
          }
          break;
      }
    },

    // 执行快速命令
    executeQuickCommand(command: string) {
      this.inputCommand = command;
      this.executeCommand();
    },

    // 获取样式类
    getHistoryClass(item: TerminalHistory) {
      switch (item.type) {
        case 'command': return 'command-line';
        case 'output': return 'output-line';
        case 'error': return 'error-line';
        default: return '';
      }
    },

    // 打开软键盘
    openKeyboard() {
      openSoftKeyboard(
        () => this.inputCommand,
        (value) => { 
          this.inputCommand = value; 
          this.$forceUpdate();
        }
      );
    }
  }
});

export default shell;