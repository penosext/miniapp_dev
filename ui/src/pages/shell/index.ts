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

// Shell API 模块类型定义
interface ShellAPI {
  initialize(): Promise<void>;
  exec(cmd: string): Promise<string>;
}

// 终端行类型
interface TerminalLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'system';
  content: string;
  timestamp: number;
}

// 快速命令类型
interface QuickCommand {
  id: string;
  label: string;
  command: string;
  description: string;
  category: 'file' | 'system' | 'network' | 'tool';
}

export default defineComponent({
  data() {
    return {
      $page: {} as FalconPage<Record<string, any>>,
      
      // 输入和状态
      inputText: '',
      isExecuting: false,
      currentDir: '~',
      shellInitialized: false,
      
      // 终端内容
      terminalLines: [] as TerminalLine[],
      
      // 命令历史
      commandHistory: [] as string[],
      historyIndex: -1,
      showHistoryList: false,
      
      // Shell模块引用
      shellModule: null as ShellAPI | null,
      
      // 快速命令配置
      quickCommands: [
        { id: 'ls', label: 'ls', command: 'ls -la', description: '列出文件', category: 'file' },
        { id: 'pwd', label: 'pwd', command: 'pwd', description: '当前路径', category: 'file' },
        { id: 'cat', label: 'cat', command: 'cat /proc/cpuinfo', description: 'CPU信息', category: 'system' },
        { id: 'ps', label: 'ps', command: 'ps aux', description: '进程列表', category: 'system' },
        { id: 'df', label: 'df', command: 'df -h', description: '磁盘空间', category: 'system' },
        { id: 'date', label: 'date', command: 'date', description: '系统时间', category: 'system' },
        { id: 'free', label: 'free', command: 'free -m', description: '内存使用', category: 'system' },
        { id: 'uname', label: '系统', command: 'uname -a', description: '系统信息', category: 'system' },
        { id: 'ping', label: '网络', command: 'ping -c 3 8.8.8.8', description: '网络测试', category: 'network' },
        { id: 'clear', label: '清屏', command: 'clear', description: '清屏', category: 'tool' },
        { id: 'help', label: '帮助', command: 'help', description: '查看帮助', category: 'tool' },
        { id: 'exit', label: '退出', command: 'exit', description: '退出终端', category: 'tool' }
      ] as QuickCommand[],
      
      // 当前选择的快速命令类别
      selectedCategory: 'all' as 'all' | 'file' | 'system' | 'network' | 'tool',
      
      // 终端设置
      autoScroll: true,
      showTimestamp: false,
      maxLines: 1000, // 最多保留1000行历史
    };
  },

  mounted() {
    this.initializeShell();
    this.addWelcomeMessage();
    
    // 设置页面返回键处理
    this.$page.$npage.setSupportBack(true);
    this.$page.$npage.on("backpressed", this.handleBackPress);
  },

  beforeDestroy() {
    this.$page.$npage.off("backpressed", this.handleBackPress);
  },

  computed: {
    // 是否可以执行命令
    canExecute(): boolean {
      return this.inputText.trim().length > 0 && !this.isExecuting;
    },
    
    // 过滤后的快速命令
    filteredQuickCommands(): QuickCommand[] {
      if (this.selectedCategory === 'all') {
        return this.quickCommands;
      }
      return this.quickCommands.filter(cmd => cmd.category === this.selectedCategory);
    },
    
    // 按类别分组的命令
    categorizedCommands(): Record<string, QuickCommand[]> {
      const categories: Record<string, QuickCommand[]> = {
        file: [],
        system: [],
        network: [],
        tool: []
      };
      
      this.quickCommands.forEach(cmd => {
        categories[cmd.category].push(cmd);
      });
      
      return categories;
    },
    
    // 类别中文显示
    categoryLabels(): Record<string, string> {
      return {
        all: '全部',
        file: '文件',
        system: '系统',
        network: '网络',
        tool: '工具'
      };
    }
  },

  watch: {
    // 监听终端行数，超出限制时删除旧行
    terminalLines: {
      handler(lines: TerminalLine[]) {
        if (lines.length > this.maxLines) {
          this.terminalLines = lines.slice(lines.length - this.maxLines);
        }
      },
      deep: true
    },
    
    // 自动滚动到底部
    terminalLines: {
      handler() {
        if (this.autoScroll) {
          this.$nextTick(() => {
            this.scrollToBottom();
          });
        }
      },
      deep: true,
      immediate: true
    }
  },

  methods: {
    // ==================== 初始化方法 ====================
    
    // 初始化Shell模块
    async initializeShell() {
      try {
        // 显示初始化状态
        this.addTerminalLine('system', '正在初始化Shell模块...');
        
        // 动态导入Shell模块
        this.shellModule = require('shell');
        
        // 初始化Shell
        await this.shellModule.initialize();
        
        this.shellInitialized = true;
        this.addTerminalLine('system', '✓ Shell模块初始化成功');
        this.addTerminalLine('system', '输入 "help" 查看可用命令');
        
      } catch (error: any) {
        this.addTerminalLine('error', `✗ Shell模块初始化失败: ${error.message || '未知错误'}`);
        this.addTerminalLine('error', '请检查Shell模块是否正确安装');
        this.shellInitialized = false;
      }
    },
    
    // 添加欢迎消息
    addWelcomeMessage() {
      this.addTerminalLine('system', '=== 终端工具 ===');
      this.addTerminalLine('system', '版本: 1.0.0');
      this.addTerminalLine('system', '作者: Langning Chen');
      this.addTerminalLine('system', '输入 "help" 查看帮助信息');
    },
    
    // ==================== 终端操作 ====================
    
    // 添加终端行
    addTerminalLine(type: TerminalLine['type'], content: string) {
      const timestamp = Date.now();
      const timeStr = this.showTimestamp ? 
        `[${new Date(timestamp).toLocaleTimeString()}] ` : '';
      
      this.terminalLines.push({
        id: `line_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        content: timeStr + content,
        timestamp
      });
    },
    
    // 执行命令
    async executeCommand() {
      const command = this.inputText.trim();
      if (!command || this.isExecuting) return;
      
      // 显示命令
      this.addTerminalLine('command', `${this.currentDir} $ ${command}`);
      
      // 保存到历史记录
      this.saveToHistory(command);
      
      // 清空输入框
      this.inputText = '';
      this.historyIndex = this.commandHistory.length;
      
      // 处理内置命令
      if (await this.handleBuiltinCommand(command)) {
        return;
      }
      
      // 检查Shell是否初始化
      if (!this.shellInitialized || !this.shellModule) {
        this.addTerminalLine('error', '错误: Shell模块未初始化');
        this.addTerminalLine('system', '请尝试重新打开终端或重启应用');
        return;
      }
      
      // 执行系统命令
      await this.executeSystemCommand(command);
    },
    
    // 执行系统命令
    async executeSystemCommand(command: string) {
      this.isExecuting = true;
      
      try {
        // 添加执行开始提示
        this.addTerminalLine('system', `正在执行: ${command}`);
        
        // 执行命令
        const result = await this.shellModule!.exec(command);
        
        // 处理输出结果
        if (result && result.trim()) {
          this.addTerminalLine('output', result);
        } else {
          this.addTerminalLine('output', '命令执行完成，无输出');
        }
        
      } catch (error: any) {
        this.addTerminalLine('error', `执行失败: ${error.message || '未知错误'}`);
        
        // 根据错误类型给出建议
        if (error.message.includes('permission')) {
          this.addTerminalLine('system', '提示: 可能需要root权限执行此命令');
        } else if (error.message.includes('not found')) {
          this.addTerminalLine('system', '提示: 命令不存在或未安装相关工具');
        }
      } finally {
        this.isExecuting = false;
      }
    },
    
    // 处理内置命令
    async handleBuiltinCommand(command: string): Promise<boolean> {
      const [cmd, ...args] = command.trim().split(' ');
      const lowerCmd = cmd.toLowerCase();
      
      switch (lowerCmd) {
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
          this.showCommandHistory();
          return true;
          
        case 'exit':
          this.exitTerminal();
          return true;
          
        case 'cls':
          this.clearTerminal();
          return true;
          
        case 'reset':
          this.resetTerminal();
          return true;
          
        case 'version':
          this.showVersion();
          return true;
          
        case 'test':
          this.runTestCommand();
          return true;
          
        default:
          // 检查是否以./开头（相对路径命令）
          if (command.startsWith('./')) {
            this.addTerminalLine('system', `执行脚本: ${command}`);
            return false;
          }
          
          // 检查是否包含特殊字符
          if (command.includes('|') || command.includes('>') || command.includes('&')) {
            this.addTerminalLine('system', `执行管道命令: ${command}`);
            return false;
          }
          
          // 不是内置命令，交给系统执行
          return false;
      }
    },
    
    // ==================== 内置命令实现 ====================
    
    // 显示帮助
    showHelp() {
      const helpText = `
终端命令帮助:

=== 内置命令 ===
help          显示此帮助信息
clear         清空终端屏幕
echo [文本]   输出文本内容
pwd           显示当前工作目录
cd [目录]     切换工作目录
history       显示命令历史记录
exit          退出终端
reset         重置终端（清除历史）
version       显示终端版本信息
test          运行测试命令

=== 系统命令示例 ===
ls -la        列出文件（详细信息）
cat [文件]    查看文件内容
ps aux        查看所有进程
df -h         查看磁盘使用情况
free -m       查看内存使用情况
uname -a      查看系统信息
date          查看日期时间
ping [主机]   网络连通性测试

=== 使用技巧 ===
1. 按↑↓键可以浏览历史命令
2. 点击下方快速命令可快速执行
3. 点击输入框可调出软键盘
4. 清屏不会清除命令历史

=== 注意事项 ===
1. 部分命令可能需要root权限
2. 执行未知命令前请确认安全性
3. 终端输出可能有延迟，请耐心等待
`;
      
      this.addTerminalLine('output', helpText);
    },
    
    // 显示命令历史
    showCommandHistory() {
      if (this.commandHistory.length === 0) {
        this.addTerminalLine('output', '命令历史为空');
        return;
      }
      
      let historyText = '命令历史记录:\n';
      this.commandHistory.forEach((cmd, index) => {
        historyText += `${index + 1}. ${cmd}\n`;
      });
      
      this.addTerminalLine('output', historyText);
    },
    
    // 切换目录
    changeDirectory(path: string) {
      if (path === '~' || path === '') {
        this.currentDir = '~';
      } else if (path === '..') {
        // 处理上级目录
        if (this.currentDir === '~' || this.currentDir === '/') {
          this.currentDir = '/';
        } else {
          const parts = this.currentDir.split('/').filter(p => p);
          if (parts.length > 0) parts.pop();
          this.currentDir = parts.length > 0 ? '/' + parts.join('/') : '/';
        }
      } else if (path.startsWith('/')) {
        // 绝对路径
        this.currentDir = path;
      } else if (path.startsWith('~')) {
        // 家目录相对路径
        this.currentDir = path.replace('~', '/home/user');
      } else {
        // 相对路径
        const base = this.currentDir === '~' ? '' : this.currentDir;
        this.currentDir = base + (base.endsWith('/') ? '' : '/') + path;
      }
      
      this.addTerminalLine('output', `当前目录: ${this.currentDir}`);
    },
    
    // 显示版本信息
    showVersion() {
      this.addTerminalLine('system', '终端工具 v1.0.0');
      this.addTerminalLine('system', '基于Falcon框架开发');
      this.addTerminalLine('system', '支持Linux命令执行');
      this.addTerminalLine('system', 'GitHub: https://github.com/langningchen');
    },
    
    // 运行测试命令
    runTestCommand() {
      this.addTerminalLine('system', '运行测试命令...');
      this.addTerminalLine('output', '系统时间: ' + new Date().toString());
      this.addTerminalLine('output', '终端状态: 正常运行');
      this.addTerminalLine('output', 'Shell状态: ' + (this.shellInitialized ? '已初始化' : '未初始化'));
      this.addTerminalLine('output', '历史记录: ' + this.commandHistory.length + ' 条命令');
      this.addTerminalLine('output', '终端行数: ' + this.terminalLines.length + ' 行');
    },
    
    // 重置终端
    resetTerminal() {
      this.clearTerminal();
      this.commandHistory = [];
      this.historyIndex = -1;
      this.inputText = '';
      this.addTerminalLine('system', '终端已重置');
      this.addWelcomeMessage();
    },
    
    // 退出终端
    exitTerminal() {
      this.addTerminalLine('system', '正在退出终端...');
      setTimeout(() => {
        this.$page.finish();
      }, 500);
    },
    
    // ==================== 历史记录管理 ====================
    
    // 保存到历史记录
    saveToHistory(command: string) {
      // 去重：不保存重复的连续命令
      const lastCommand = this.commandHistory[this.commandHistory.length - 1];
      if (lastCommand !== command) {
        this.commandHistory.push(command);
        
        // 限制历史记录长度
        if (this.commandHistory.length > 100) {
          this.commandHistory.shift();
        }
      }
      
      this.historyIndex = this.commandHistory.length;
    },
    
    // 导航历史记录
    navigateHistory(direction: -1 | 1) {
      if (this.commandHistory.length === 0) return;
      
      if (direction === -1) { // 上箭头 - 向前查找
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this.inputText = this.commandHistory[this.historyIndex];
        }
      } else { // 下箭头 - 向后查找
        if (this.historyIndex < this.commandHistory.length - 1) {
          this.historyIndex++;
          this.inputText = this.commandHistory[this.historyIndex];
        } else if (this.historyIndex === this.commandHistory.length - 1) {
          this.historyIndex++;
          this.inputText = '';
        }
      }
    },
    
    // ==================== 快速命令 ====================
    
    // 执行快速命令
    executeQuickCommand(command: string) {
      this.inputText = command;
      this.executeCommand();
    },
    
    // 选择命令类别
    selectCategory(category: QuickCommand['category'] | 'all') {
      this.selectedCategory = category;
    },
    
    // ==================== 界面操作 ====================
    
    // 清空终端
    clearTerminal() {
      this.terminalLines = [];
      this.addTerminalLine('system', '终端已清空');
    },
    
    // 滚动到底部
    scrollToBottom() {
      this.$nextTick(() => {
        const scroller = this.$refs.terminalScroller as any;
        if (scroller && scroller.scrollTo) {
          setTimeout(() => {
            scroller.scrollTo({
              x: 0,
              y: 999999,
              animated: false
            });
          }, 100);
        }
      });
    },
    
    // 打开软键盘
    openKeyboard() {
      openSoftKeyboard(
        () => this.inputText,
        (value) => {
          this.inputText = value;
          this.$forceUpdate();
        },
        null, // 无验证
        true  // 多行输入
      );
    },
    
    // ==================== 事件处理 ====================
    
    // 处理返回键
    handleBackPress() {
      if (this.inputText.trim().length > 0) {
        // 如果有输入内容，先清空
        this.inputText = '';
        this.$forceUpdate();
        return;
      }
      
      if (this.terminalLines.length > 10) {
        // 如果有较多内容，先清屏再提示
        this.clearTerminal();
        this.addTerminalLine('system', '再次按返回键退出终端');
        return;
      }
      
      // 直接退出
      this.$page.finish();
    },
    
    // 处理键盘事件
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
          
        case 'Escape':
          e.preventDefault();
          this.inputText = '';
          break;
          
        case 'Tab':
          e.preventDefault();
          this.autoCompleteCommand();
          break;
      }
    },
    
    // 命令自动补全（简单实现）
    autoCompleteCommand() {
      if (!this.inputText.trim()) return;
      
      const input = this.inputText.toLowerCase();
      
      // 从历史记录中查找匹配的命令
      const matchingHistory = this.commandHistory.filter(cmd => 
        cmd.toLowerCase().startsWith(input)
      );
      
      if (matchingHistory.length > 0) {
        // 使用第一个匹配项
        this.inputText = matchingHistory[0];
        this.$forceUpdate();
      }
    }
  }
});