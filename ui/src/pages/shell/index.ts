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

// Shell API 类型定义
interface ShellAPI {
  initialize(): Promise<void>;
  exec(cmd: string): Promise<string>;
}

interface TerminalLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'system';
  content: string;
  timestamp: number;
}

interface QuickCommand {
  id: string;
  label: string;
  command: string;
  description: string;
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
      
      // Shell模块引用
      shellModule: null as ShellAPI | null,
      
      // 快速命令配置
      quickCommands: [
        { id: 'ls', label: 'ls', command: 'ls -la', description: '列出文件' },
        { id: 'pwd', label: 'pwd', command: 'pwd', description: '当前路径' },
        { id: 'ps', label: 'ps', command: 'ps aux', description: '进程列表' },
        { id: 'df', label: 'df', command: 'df -h', description: '磁盘空间' },
        { id: 'date', label: 'date', command: 'date', description: '系统时间' },
        { id: 'free', label: 'free', command: 'free -m', description: '内存使用' },
        { id: 'system', label: '系统', command: 'uname -a', description: '系统信息' },
        { id: 'network', label: '网络', command: 'ping -c 3 8.8.8.8', description: '网络测试' },
        { id: 'clear', label: '清屏', command: 'clear', description: '清屏' },
        { id: 'help', label: '帮助', command: 'help', description: '查看帮助' }
      ] as QuickCommand[],
    };
  },

  mounted() {
    console.log('Shell页面开始加载...');
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
    canExecute(): boolean {
      return this.inputText.trim().length > 0 && !this.isExecuting && this.shellInitialized;
    }
  },

  methods: {
    // 调试方法：检查全局对象
    debugGlobalObjects() {
      console.log('检查全局对象...');
      console.log('globalThis:', Object.keys(globalThis).filter(key => 
        key.toLowerCase().includes('shell') || key.toLowerCase().includes('shell')
      ));
      
      // 检查require函数
      if (typeof require !== 'undefined') {
        console.log('require函数可用');
        try {
          const modules = require.cache || {};
          console.log('已加载模块:', Object.keys(modules));
        } catch (e) {
          console.log('无法获取模块缓存');
        }
      }
    },

    // 初始化Shell模块
    async initializeShell() {
      try {
        this.addTerminalLine('system', '正在初始化Shell模块...');
        
        // 先进行全局对象调试
        this.debugGlobalObjects();
        
        // 方法1：使用 require('shell')
        try {
          console.log('尝试方法1: require("shell")');
          const shell = require('shell');
          console.log('shell模块加载成功:', shell);
          console.log('模块方法:', Object.keys(shell));
          
          if (typeof shell.initialize === 'function') {
            await shell.initialize();
            this.shellModule = shell;
            this.shellInitialized = true;
            this.addTerminalLine('system', '✓ Shell模块初始化成功');
            
            // 测试一个简单命令
            setTimeout(async () => {
              try {
                this.addTerminalLine('system', '正在测试Shell功能...');
                const testResult = await shell.exec('echo "Shell测试成功"');
                console.log('Shell测试结果:', testResult);
                this.addTerminalLine('output', 'Shell功能测试: 正常');
              } catch (testErr) {
                console.error('Shell测试失败:', testErr);
                this.addTerminalLine('error', 'Shell功能测试失败');
              }
            }, 1000);
            
            return;
          } else {
            console.log('shell模块没有initialize方法');
          }
        } catch (err1) {
          console.log('方法1失败:', err1);
        }
        
        // 方法2：检查全局Shell对象
        try {
          console.log('尝试方法2: 全局Shell对象');
          if (typeof Shell !== 'undefined') {
            console.log('找到全局Shell对象:', Shell);
            if (typeof Shell.initialize === 'function') {
              await Shell.initialize();
              this.shellModule = Shell;
              this.shellInitialized = true;
              this.addTerminalLine('system', '✓ Shell模块初始化成功（全局对象）');
              return;
            }
          }
        } catch (err2) {
          console.log('方法2失败:', err2);
        }
        
        // 方法3：尝试其他可能的模块名
        const possibleModuleNames = [
          'Shell', 'shell', 'ShellModule', 'shell_module', 
          'JSShell', 'jsShell', 'NativeShell', 'native_shell'
        ];
        
        for (const moduleName of possibleModuleNames) {
          try {
            console.log(`尝试模块名: ${moduleName}`);
            const module = require(moduleName);
            console.log(`模块 ${moduleName} 加载成功:`, module);
            
            if (typeof module.initialize === 'function') {
              await module.initialize();
              this.shellModule = module;
              this.shellInitialized = true;
              this.addTerminalLine('system', `✓ Shell模块初始化成功 (${moduleName})`);
              return;
            }
          } catch (err) {
            console.log(`模块 ${moduleName} 加载失败:`, err.message);
          }
        }
        
        // 所有方法都失败
        throw new Error('无法找到可用的Shell模块');
        
      } catch (error: any) {
        console.error('Shell模块初始化最终失败:', error);
        console.error('错误堆栈:', error.stack);
        
        this.addTerminalLine('error', `✗ Shell模块初始化失败`);
        this.addTerminalLine('error', `错误信息: ${error.message}`);
        this.addTerminalLine('system', '可能的原因:');
        this.addTerminalLine('system', '1. Shell模块未正确编译或集成');
        this.addTerminalLine('system', '2. 模块导出名称不正确');
        this.addTerminalLine('system', '3. JS Bridge配置错误');
        this.addTerminalLine('system', '4. 缺少必要的Native依赖');
        
        this.shellInitialized = false;
      }
    },
    
    // 添加终端行
    addTerminalLine(type: TerminalLine['type'], content: string) {
      const timestamp = Date.now();
      
      this.terminalLines.push({
        id: `line_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        content,
        timestamp
      });
      
      // 自动滚动
      this.scrollToBottom();
    },
    
    // 添加欢迎消息
    addWelcomeMessage() {
      this.addTerminalLine('system', '=== Shell终端 ===');
      this.addTerminalLine('system', '版本: 1.0.0');
      this.addTerminalLine('system', '状态: ' + (this.shellInitialized ? '已就绪' : '初始化中...'));
      this.addTerminalLine('system', '输入 "help" 查看帮助');
    },
    
    // 执行命令
    async executeCommand() {
      const command = this.inputText.trim();
      if (!command || this.isExecuting) return;
      
      // 显示命令
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
      
      // 检查Shell状态
      if (!this.shellInitialized || !this.shellModule) {
        this.addTerminalLine('error', '错误: Shell模块未初始化');
        this.addTerminalLine('system', '请尝试重新初始化: 输入 "reset" 命令');
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
          if (args[0] === '~') {
            this.currentDir = '~';
          } else if (args[0]) {
            this.currentDir = args[0];
          }
          this.addTerminalLine('output', `当前目录: ${this.currentDir}`);
          return true;
          
        case 'history':
          this.showHistory();
          return true;
          
        case 'reset':
          this.resetTerminal();
          return true;
          
        case 'test':
          await this.testShell();
          return true;
          
        default:
          return false;
      }
    },
    
    // 执行系统命令
    async executeSystemCommand(command: string) {
      this.isExecuting = true;
      this.addTerminalLine('system', '执行中...');
      
      try {
        console.log('执行命令:', command);
        
        // 记录开始时间
        const startTime = Date.now();
        
        // 执行命令
        const result = await this.shellModule!.exec(command);
        
        // 计算执行时间
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log('命令执行结果:', result);
        console.log('执行耗时:', duration, 'ms');
        
        // 显示结果
        if (result && result.trim()) {
          this.addTerminalLine('output', result);
          this.addTerminalLine('system', `✓ 执行完成 (${duration}ms)`);
        } else {
          this.addTerminalLine('output', '命令执行完成，无输出');
          this.addTerminalLine('system', `✓ 执行完成 (${duration}ms)`);
        }
        
      } catch (error: any) {
        console.error('命令执行失败:', error);
        this.addTerminalLine('error', `执行失败: ${error.message || '未知错误'}`);
        
        // 常见错误提示
        if (error.message.includes('permission denied')) {
          this.addTerminalLine('system', '提示: 权限不足，可能需要root权限');
        } else if (error.message.includes('not found')) {
          this.addTerminalLine('system', '提示: 命令不存在或路径错误');
        } else if (error.message.includes('timeout')) {
          this.addTerminalLine('system', '提示: 命令执行超时');
        }
      } finally {
        this.isExecuting = false;
      }
    },
    
    // 测试Shell功能
    async testShell() {
      if (!this.shellInitialized || !this.shellModule) {
        this.addTerminalLine('error', 'Shell模块未初始化');
        return;
      }
      
      this.addTerminalLine('system', '开始Shell功能测试...');
      
      const testCommands = [
        { cmd: 'echo "Shell测试"', desc: '基本echo命令' },
        { cmd: 'ls /', desc: '根目录列表' },
        { cmd: 'pwd', desc: '当前路径' },
        { cmd: 'date', desc: '系统时间' }
      ];
      
      for (const test of testCommands) {
        try {
          this.addTerminalLine('system', `测试: ${test.desc}...`);
          const result = await this.shellModule.exec(test.cmd);
          this.addTerminalLine('output', `${test.desc}: ${result.trim()}`);
        } catch (error: any) {
          this.addTerminalLine('error', `${test.desc}失败: ${error.message}`);
        }
        await this.delay(500); // 延迟避免过快
      }
      
      this.addTerminalLine('system', 'Shell测试完成');
    },
    
    // 延迟函数
    delay(ms: number): Promise<void> {
      return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    // 显示帮助
    showHelp() {
      const helpText = `
可用命令:

=== 内置命令 ===
help          显示帮助信息
clear         清空终端
echo [文本]   输出文本
pwd           显示当前目录
cd [目录]     切换目录
history       显示命令历史
reset         重置终端
test          测试Shell功能

=== 系统命令示例 ===
ls            列出文件
ls -la        详细文件列表
ps aux        查看进程
df -h         磁盘使用情况
free -m       内存使用情况
uname -a      系统信息
date          日期时间
ping -c 3 8.8.8.8  网络测试

=== 使用技巧 ===
1. 点击下方快速命令可快速执行
2. 按↑↓键浏览历史命令
3. 点击输入框可调出软键盘

状态: ${this.shellInitialized ? 'Shell模块已就绪' : 'Shell模块未初始化'}
`;
      this.addTerminalLine('output', helpText);
    },
    
    // 显示历史
    showHistory() {
      if (this.commandHistory.length === 0) {
        this.addTerminalLine('output', '命令历史为空');
        return;
      }
      
      let history = '命令历史:\n';
      this.commandHistory.forEach((cmd, index) => {
        history += `${index + 1}. ${cmd}\n`;
      });
      
      this.addTerminalLine('output', history);
    },
    
    // 重置终端
    resetTerminal() {
      this.terminalLines = [];
      this.commandHistory = [];
      this.historyIndex = -1;
      this.inputText = '';
      this.addTerminalLine('system', '终端已重置');
      this.initializeShell();
    },
    
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
          }, 50);
        }
      });
    },
    
    // 导航历史记录
    navigateHistory(direction: -1 | 1) {
      if (this.commandHistory.length === 0) return;
      
      if (direction === -1) {
        if (this.historyIndex > 0) this.historyIndex--;
        if (this.historyIndex >= 0) {
          this.inputText = this.commandHistory[this.historyIndex];
        }
      } else {
        if (this.historyIndex < this.commandHistory.length - 1) {
          this.historyIndex++;
          this.inputText = this.commandHistory[this.historyIndex];
        } else if (this.historyIndex === this.commandHistory.length - 1) {
          this.historyIndex++;
          this.inputText = '';
        }
      }
    },
    
    // 执行快速命令
    executeQuickCommand(command: string) {
      this.inputText = command;
      this.executeCommand();
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
      
      if (this.terminalLines.length > 5) {
        this.clearTerminal();
        this.addTerminalLine('system', '再次按返回键退出');
        return;
      }
      
      this.$page.finish();
    }
  }
});
