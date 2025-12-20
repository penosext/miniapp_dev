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
import { openSoftKeyboard } from '../../utils/softKeyboardUtils';
import { showError, showSuccess } from '../../components/ToastMessage';

// Shell API 模块
declare const ShellModule: {
  initialize(): Promise<void>;
  exec(cmd: string): Promise<string>;
};

interface TerminalLine {
  id: string;
  type: 'command' | 'output' | 'error';
  content: string;
  timestamp: number;
}

interface QuickCommand {
  label: string;
  command: string;
  description: string;
}

export default defineComponent({
  data() {
    return {
      $page: {} as FalconPage<Record<string, any>>,
      inputText: '',
      isExecuting: false,
      currentDir: '~',
      terminalLines: [] as TerminalLine[],
      commandHistory: [] as string[],
      historyIndex: -1,
      shellModule: null as any,
      
      quickCommands: [
        { label: 'ls', command: 'ls -la', description: '列出文件' },
        { label: 'pwd', command: 'pwd', description: '当前目录' },
        { label: 'ps', command: 'ps aux', description: '进程列表' },
        { label: 'df', command: 'df -h', description: '磁盘空间' },
        { label: 'date', command: 'date', description: '系统时间' },
        { label: 'free', command: 'free -m', description: '内存使用' },
        { label: 'network', command: 'ping -c 3 8.8.8.8', description: '网络测试' },
        { label: 'system', command: 'uname -a', description: '系统信息' },
        { label: 'clear', command: 'clear', description: '清屏' }
      ] as QuickCommand[],
    };
  },

  mounted() {
    this.initializeShell();
    this.addWelcomeMessage();
    
    // 设置页面返回键处理
    this.$page.$npage.on("backpressed", this.handleBackPress);
  },

  beforeDestroy() {
    this.$page.$npage.off("backpressed", this.handleBackPress);
  },

  computed: {
    canExecute(): boolean {
      return this.inputText.trim().length > 0 && !this.isExecuting;
    }
  },

  methods: {
    // 初始化Shell
    async initializeShell() {
      try {
        // 动态导入Shell模块
        this.shellModule = require('shell');
        await this.shellModule.initialize();
        this.addTerminalLine('output', '✓ Shell初始化成功');
      } catch (error: any) {
        this.addTerminalLine('error', `✗ Shell初始化失败: ${error.message || '未知错误'}`);
      }
    },

    // 添加欢迎消息
    addWelcomeMessage() {
      this.addTerminalLine('output', '=== 终端工具 ===');
      this.addTerminalLine('output', '输入 "help" 查看帮助');
      this.addTerminalLine('output', '按↑↓键浏览历史命令');
    },

    // 添加终端行
    addTerminalLine(type: 'command' | 'output' | 'error', content: string) {
      this.terminalLines.push({
        id: `line_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        content,
        timestamp: Date.now()
      });
      this.scrollToBottom();
    },

    // 执行命令
    async executeCommand() {
      const command = this.inputText.trim();
      if (!command || this.isExecuting) return;

      // 记录命令
      this.addTerminalLine('command', `${this.currentDir} $ ${command}`);
      
      // 保存到历史记录
      if (this.commandHistory[this.commandHistory.length - 1] !== command) {
        this.commandHistory.push(command);
      }
      this.historyIndex = this.commandHistory.length;
      this.inputText = '';

      // 处理内置命令
      if (await this.handleBuiltinCommand(command)) {
        return;
      }

      // 执行系统命令
      await this.executeSystemCommand(command);
    },

    // 处理内置命令
    async handleBuiltinCommand(command: string): Promise<boolean> {
      const [cmd, ...args] = command.split(' ');
      
      switch (cmd.toLowerCase()) {
        case 'help':
          this.showHelp();
          return true;
          
        case 'clear':
          this.clearTerminal();
          return true;
          
        case 'echo':
          this.addTerminalLine('output', args.join(' '));
          return true;
          
        case 'pwd':
          this.addTerminalLine('output', this.currentDir);
          return true;
          
        case 'cd':
          this.changeDirectory(args[0] || '~');
          return true;
          
        case 'history':
          this.showHistory();
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
      const help = `
内置命令:
  help      显示帮助信息
  clear     清空终端
  echo      输出文本
  pwd       显示当前目录
  cd        切换目录
  history   显示命令历史
  exit      退出终端

系统命令:
  ls -la    列出文件
  ps aux    查看进程
  df -h     磁盘使用情况
  free -m   内存使用情况
  uname -a  系统信息
  date      日期时间
`;
      this.addTerminalLine('output', help);
    },

    // 显示历史
    showHistory() {
      if (this.commandHistory.length === 0) {
        this.addTerminalLine('output', '命令历史为空');
        return;
      }
      
      const history = this.commandHistory
        .map((cmd, index) => `${index + 1}. ${cmd}`)
        .join('\n');
      this.addTerminalLine('output', history);
    },

    // 切换目录
    changeDirectory(path: string) {
      if (path === '~') {
        this.currentDir = '~';
      } else if (path.startsWith('/')) {
        this.currentDir = path;
      } else if (path === '..') {
        const parts = this.currentDir.split('/').filter(p => p);
        if (parts.length > 0) parts.pop();
        this.currentDir = parts.length > 0 ? '/' + parts.join('/') : '/';
      } else {
        this.currentDir = this.currentDir === '/' ? 
          `/${path}` : `${this.currentDir}/${path}`;
      }
      this.addTerminalLine('output', `当前目录: ${this.currentDir}`);
    },

    // 执行系统命令
    async executeSystemCommand(command: string) {
      this.isExecuting = true;
      
      try {
        if (!this.shellModule) {
          throw new Error('Shell模块未初始化');
        }
        
        const result = await this.shellModule.exec(command);
        this.addTerminalLine('output', result || '命令执行完成');
        
      } catch (error: any) {
        this.addTerminalLine('error', `执行失败: ${error.message || '未知错误'}`);
      } finally {
        this.isExecuting = false;
        this.scrollToBottom();
      }
    },

    // 执行快速命令
    executeQuickCommand(command: string) {
      this.inputText = command;
      this.executeCommand();
    },

    // 清空终端
    clearTerminal() {
      this.terminalLines = [];
    },

    // 滚动到底部
    scrollToBottom() {
      this.$nextTick(() => {
        const scroller = this.$refs.scroller as any;
        if (scroller && scroller.scrollTo) {
          setTimeout(() => {
            scroller.scrollTo({
              x: 0,
              y: 999999,
              animated: true
            });
          }, 50);
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
          this.navigateHistory(-1);
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          this.navigateHistory(1);
          break;
      }
    },

    // 导航历史记录
    navigateHistory(direction: number) {
      if (this.commandHistory.length === 0) return;
      
      if (direction === -1) { // 上箭头
        if (this.historyIndex > 0) this.historyIndex--;
        if (this.historyIndex >= 0) {
          this.inputText = this.commandHistory[this.historyIndex];
        }
      } else { // 下箭头
        if (this.historyIndex < this.commandHistory.length - 1) {
          this.historyIndex++;
          this.inputText = this.commandHistory[this.historyIndex];
        } else if (this.historyIndex === this.commandHistory.length - 1) {
          this.historyIndex++;
          this.inputText = '';
        }
      }
    },

    // 打开软键盘
    openKeyboard() {
      openSoftKeyboard(
        () => this.inputText,
        (value) => {
          this.inputText = value;
          this.$forceUpdate();
        }
      );
    },

    // 处理返回键
    handleBackPress() {
      if (this.inputText.trim()) {
        this.inputText = '';
        this.$forceUpdate();
        return;
      }
      
      // 确认退出
      this.$page.finish();
    }
  }
});