// Copyright (C) 2025 wyxdlz54188
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
import { Shell } from 'langningchen';

// 在顶部添加导入（如果不存在）
import { showInfo } from '../../components/ToastMessage';

// Shell API 类型定义
interface ShellAPI {
  initialize(): Promise<void>;
  exec(cmd: string): Promise<string>;
}

interface TerminalLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'system' | 'password';
  content: string;
  timestamp: number;
}

export default defineComponent({
  data() {
    return {
      $page: {} as FalconPage<Record<string, any>>,
      
      // 输入和状态
      inputText: '',
      isExecuting: false,
      currentDir: '/',
      shellInitialized: false,
      
      // 终端内容
      terminalLines: [] as TerminalLine[],
      
      // 命令历史
      commandHistory: [] as string[],
      historyIndex: -1,
      
      // Shell模块引用
      shellModule: null as ShellAPI | null,
      
      // passwd相关状态
      passwdInProgress: false,
      passwdStep: 0,
      newPassword: '',
      confirmPassword: '',
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
      return this.inputText.trim().length > 0 && !this.isExecuting && this.shellInitialized && !this.passwdInProgress;
    }
  },

  methods: {
    // 初始化Shell模块
    async initializeShell() {
      try {
        this.addTerminalLine('system', '正在初始化Shell模块...');
        
        // 直接使用从langningchen导入的Shell
        console.log('使用langningchen.Shell模块...');
        
        // 检查Shell对象是否存在
        if (!Shell) {
          throw new Error('Shell对象未定义');
        }
        
        // 检查initialize方法是否存在
        if (typeof Shell.initialize !== 'function') {
          throw new Error('Shell.initialize方法不存在');
        }
        
        // 初始化Shell
        await Shell.initialize();
        
        this.shellModule = Shell;
        this.shellInitialized = true;
        this.addTerminalLine('system', 'Shell模块初始化成功');
        
        // 获取初始目录
        try {
          const result = await Shell.exec('pwd');
          this.currentDir = result.trim();
          this.addTerminalLine('system', `当前目录: ${this.currentDir}`);
        } catch (error: any) {
          this.addTerminalLine('system', `当前目录: / (默认)`);
        }
        
        // 测试Shell功能
        setTimeout(async () => {
          try {
            const result = await Shell.exec('echo "Shell终端已就绪"');
            this.addTerminalLine('output', result.trim());
          } catch (error: any) {
            this.addTerminalLine('error', `Shell测试失败: ${error.message}`);
          }
        }, 500);
        
      } catch (error: any) {
        console.error('Shell模块初始化失败:', error);
        this.addTerminalLine('error', `Shell模块初始化失败: ${error.message}`);
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
      this.addTerminalLine('system', '基于langningchen.Shell模块');
      this.addTerminalLine('system', '输入 "help" 查看帮助');
      this.addTerminalLine('system', '提示: 使用 vi <文件名> 编辑文件');
    },
    
    // 执行命令
    async executeCommand() {
      const command = this.inputText.trim();
      if (!command || this.isExecuting) return;
      
      // 如果是passwd命令且正在进行中，处理密码输入
      if (this.passwdInProgress) {
        await this.handlePasswdInput(command);
        this.inputText = '';
        return;
      }
      
      // 显示命令
      this.addTerminalLine('command', `${this.currentDir} $ ${command}`);
      
      // 保存到历史记录
      if (this.commandHistory[this.commandHistory.length - 1] !== command) {
        this.commandHistory.push(command);
      }
      this.historyIndex = this.commandHistory.length;
      this.inputText = '';
      
      // 检查Shell状态
      if (!this.shellInitialized || !Shell) {
        this.addTerminalLine('error', '错误: Shell模块未初始化');
        return;
      }
      
      // 处理内置命令（包括vi和passwd）
      if (await this.handleBuiltinCommand(command)) {
        return;
      }
      
      // 执行命令（包含目录切换处理）
      await this.executeCommandWithDir(command);
    },
    
    // 处理内置命令（前端模拟的）
    async handleBuiltinCommand(command: string): Promise<boolean> {
      const [cmd, ...args] = command.split(' ');
      
      // 将命令转换为小写进行比较
      const lowerCmd = cmd.toLowerCase();
      
      switch (lowerCmd) {
        case 'help':
          this.showHelp();
          return true;
          
        case 'clear':
          this.clearTerminal();
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
          
        // 添加对vi命令的支持
        case 'vi':
        case 'vim':
          await this.handleViCommand(args);
          return true;
          
        case 'nano':
        case 'ed':
          // 也可以支持其他文本编辑器命令
          this.addTerminalLine('system', `尝试使用 ${cmd} 编辑器`);
          this.addTerminalLine('system', '正在打开文本编辑器...');
          await this.handleViCommand(args);
          return true;
          
        // 添加对passwd命令的支持
        case 'passwd':
          await this.startPasswdProcess(args);
          return true;
          
        default:
          return false;
      }
    },
    
    // 开始passwd密码修改流程
    async startPasswdProcess(args: string[]) {
      const username = args[0] || 'root';
      
      // 检查当前用户是否有权限修改密码
      try {
        const currentUser = await Shell.exec('whoami');
        if (currentUser.trim() !== 'root' && username !== currentUser.trim()) {
          this.addTerminalLine('error', `passwd: 只有root用户才能修改其他用户的密码`);
          return;
        }
      } catch (error: any) {
        // 忽略错误，继续执行
      }
      
      this.passwdInProgress = true;
      this.passwdStep = 1;
      this.newPassword = '';
      this.confirmPassword = '';
      
      // 显示passwd交互界面
      this.addTerminalLine('password', `更改 ${username} 用户的密码`);
      this.addTerminalLine('password', '(当前) UNIX 密码：');
      
      // 模拟密码输入（不显示实际字符）
      this.inputText = '';
    },
    
    // 处理passwd密码输入
    async handlePasswdInput(input: string) {
      // 模拟密码输入（不显示实际字符）
      this.addTerminalLine('password', '*'.repeat(input.length));
      
      if (this.passwdStep === 1) {
        // 第一步：输入当前密码（这里简单跳过验证，实际应该验证）
        // 在实际系统中，这里应该验证当前密码是否正确
        // 由于我们是root用户，通常可以直接修改
        
        this.addTerminalLine('password', '新的 密码：');
        this.passwdStep = 2;
        this.newPassword = input;
      } else if (this.passwdStep === 2) {
        // 第二步：确认新密码
        this.addTerminalLine('password', '重新输入新的 密码：');
        this.passwdStep = 3;
        this.confirmPassword = input;
        
        // 检查两次密码是否一致
        if (this.newPassword !== this.confirmPassword) {
          this.addTerminalLine('error', '抱歉，密码不匹配。');
          this.addTerminalLine('password', '新的 密码：');
          this.passwdStep = 2;
          this.newPassword = '';
          this.confirmPassword = '';
          return;
        }
        
        // 检查密码强度（简单检查）
        if (this.newPassword.length < 6) {
          this.addTerminalLine('error', '密码过短，必须至少 6 个字符。');
          this.addTerminalLine('password', '新的 密码：');
          this.passwdStep = 2;
          this.newPassword = '';
          this.confirmPassword = '';
          return;
        }
        
        // 密码验证通过，开始修改
        await this.changePassword(this.newPassword);
        
        // 重置状态
        this.passwdInProgress = false;
        this.passwdStep = 0;
        this.newPassword = '';
        this.confirmPassword = '';
      }
    },
    
    // 实际修改密码
    async changePassword(newPassword: string) {
      try {
        this.addTerminalLine('password', '正在更新密码...');
        
        // 检查文件系统是否可写
        const mountInfo = await Shell.exec('mount | grep " / "');
        let isReadOnly = mountInfo.includes('ro,');
        
        if (isReadOnly) {
          this.addTerminalLine('system', '检测到根文件系统为只读，尝试重新挂载为读写...');
          const remountResult = await Shell.exec('mount -o remount,rw / 2>&1');
          
          if (remountResult.includes('Permission denied') || remountResult.includes('not permitted')) {
            this.addTerminalLine('error', '无法重新挂载为读写，密码修改失败');
            return;
          }
          
          this.addTerminalLine('system', '文件系统已重新挂载为读写');
        }
        
        // 检查是否可用openssl
        const opensslCheck = await Shell.exec('which openssl 2>/dev/null || echo "not found"');
        
        let encryptedPassword = '';
        
        if (opensslCheck.includes('not found')) {
          // 如果没有openssl，尝试使用其他方法
          this.addTerminalLine('system', '未找到openssl，尝试其他加密方法...');
          
          // 尝试使用busybox的passwd
          const busyboxCheck = await Shell.exec('busybox --list 2>/dev/null | grep -i crypt || echo "not found"');
          
          if (busyboxCheck.includes('crypt')) {
            // 使用busybox生成密码
            const busyboxResult = await Shell.exec(`echo "${newPassword}" | busybox cryptpw -m md5 2>/dev/null || echo ""`);
            if (busyboxResult.trim()) {
              encryptedPassword = busyboxResult.trim();
            }
          }
          
          // 如果还不行，尝试使用Python
          if (!encryptedPassword) {
            const pythonCheck = await Shell.exec('which python3 2>/dev/null || which python 2>/dev/null || echo "not found"');
            
            if (!pythonCheck.includes('not found')) {
              const pythonCode = `
import crypt
import sys
password = sys.argv[1]
salt = crypt.mksalt(crypt.METHOD_SHA512)
hashed = crypt.crypt(password, salt)
print(hashed)
              `;
              
              try {
                const pythonResult = await Shell.exec(`python3 -c "${pythonCode.replace(/\n/g, ';')}" "${newPassword}" 2>/dev/null`);
                if (pythonResult.trim()) {
                  encryptedPassword = pythonResult.trim();
                }
              } catch (e) {
                // 忽略错误
              }
            }
          }
          
          if (!encryptedPassword) {
            this.addTerminalLine('error', '无法找到合适的密码加密工具');
            this.addTerminalLine('system', '尝试使用简单的MD5哈希（不推荐）');
            
            // 使用简单的md5sum
            const md5Result = await Shell.exec(`echo -n "${newPassword}" | md5sum | awk '{print $1}'`);
            encryptedPassword = `$1$${this.generateRandomSalt()}$${md5Result.trim()}`;
          }
        } else {
          // 使用openssl生成SHA-512加密的密码
          this.addTerminalLine('system', '使用openssl生成SHA-512加密密码...');
          
          try {
            // 生成随机salt
            const salt = this.generateRandomSalt();
            
            // 使用openssl生成密码哈希
            const opensslResult = await Shell.exec(`echo -n "${newPassword}" | openssl passwd -6 -salt ${salt} -stdin 2>/dev/null`);
            
            if (opensslResult.trim()) {
              encryptedPassword = opensslResult.trim();
            } else {
              // 如果SHA-512失败，尝试使用SHA-256
              const opensslResult2 = await Shell.exec(`echo -n "${newPassword}" | openssl passwd -5 -salt ${salt} -stdin 2>/dev/null`);
              encryptedPassword = opensslResult2.trim();
            }
          } catch (error: any) {
            this.addTerminalLine('error', `openssl加密失败: ${error.message}`);
            
            // 尝试使用其他方法
            const perlCheck = await Shell.exec('which perl 2>/dev/null || echo "not found"');
            
            if (!perlCheck.includes('not found')) {
              const perlCode = `
use Crypt::PasswdMD5;
my \$password = "${newPassword}";
my \$salt = substr(time() . $$, 0, 2);
my \$hashed = unix_md5_crypt(\$password, \$salt);
print \$hashed;
              `;
              
              try {
                const perlResult = await Shell.exec(`perl -MCrypt::PasswdMD5 -e '${perlCode.replace(/\n/g, ';').replace(/\$/g, '\\$')}' 2>/dev/null`);
                if (perlResult.trim()) {
                  encryptedPassword = perlResult.trim();
                }
              } catch (e) {
                // 忽略错误
              }
            }
          }
        }
        
        if (!encryptedPassword) {
          this.addTerminalLine('error', '无法生成加密密码');
          return;
        }
        
        this.addTerminalLine('system', `生成的密码哈希: ${encryptedPassword.substring(0, 20)}...`);
        
        // 备份旧的shadow文件
        await Shell.exec('cp /etc/shadow /etc/shadow.bak 2>/dev/null || true');
        
        // 更新shadow文件
        const updateScript = `
if grep -q "^root:" /etc/shadow; then
  sed -i "s|^root:[^:]*:|root:${encryptedPassword}:|" /etc/shadow
else
  echo "root:${encryptedPassword}:0:0:99999:7:::" >> /etc/shadow
fi
        `;
        
        await Shell.exec(updateScript);
        
        this.addTerminalLine('password', 'passwd：密码已成功更新');
        this.addTerminalLine('system', '密码已成功修改！');
        
        // 如果之前是只读的，尝试改回只读
        if (isReadOnly) {
          try {
            await Shell.exec('mount -o remount,ro / 2>/dev/null || true');
            this.addTerminalLine('system', '文件系统已恢复为只读');
          } catch (e) {
            // 忽略错误
          }
        }
        
      } catch (error: any) {
        this.addTerminalLine('error', `密码修改失败: ${error.message}`);
        this.addTerminalLine('system', '建议：如果系统使用只读文件系统，密码可能存储在单独的可写分区');
      }
    },
    
    // 生成随机salt
    generateRandomSalt(): string {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789./';
      let salt = '';
      for (let i = 0; i < 8; i++) {
        salt += chars[Math.floor(Math.random() * chars.length)];
      }
      return salt;
    },
    
    // 添加新的方法：处理vi/vim命令
    async handleViCommand(args: string[]) {
      if (args.length === 0) {
        this.addTerminalLine('error', '用法: vi <文件名>');
        this.addTerminalLine('error', '请指定要编辑的文件名');
        return;
      }
      
      const fileName = args[0];
      let filePath = '';
      
      try {
        // 判断是相对路径还是绝对路径
        if (fileName.startsWith('/')) {
          // 绝对路径
          filePath = fileName;
        } else {
          // 相对路径 - 基于当前目录
          filePath = this.currentDir === '/' ? `/${fileName}` : `${this.currentDir}/${fileName}`;
        }
        
        this.addTerminalLine('system', `正在打开文件: ${filePath}`);
        this.addTerminalLine('system', '跳转到文本编辑器...');
        
        // 跳转到文件编辑器页面
        // 使用setTimeout确保先显示终端消息再跳转
        setTimeout(() => {
          $falcon.navTo('fileEditor', {
            filePath: filePath,
            returnTo: 'shell',
            returnPath: this.currentDir,
          });
        }, 500);
        
      } catch (error: any) {
        this.addTerminalLine('error', `打开文件失败: ${error.message}`);
      }
    },
    
    // 执行命令（包含目录切换处理）
    async executeCommandWithDir(command: string) {
      this.isExecuting = true;
      
      try {
        // 首先检查是否是内置命令（包括vi）
        const [cmd, ...args] = command.split(' ');
        const lowerCmd = cmd.toLowerCase();
        
        // 如果是cd命令，特殊处理
        if (lowerCmd === 'cd') {
          await this.handleCdCommand(args);
          return;
        }
        
        // 如果是vi/vim命令，已经被handleBuiltinCommand处理了
        // 这里主要是为了确保不会重复执行
        
        console.log('执行命令:', command);
        
        // 记录开始时间
        const startTime = Date.now();
        
        // 使用langningchen.Shell.exec执行命令
        // 在命令前加上cd到当前目录，确保在工作目录执行
        const fullCommand = `cd "${this.currentDir}" && ${command}`;
        const result = await Shell.exec(fullCommand);
        
        // 计算执行时间
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log('命令执行结果:', result);
        console.log('执行耗时:', duration, 'ms');
        
        // 显示结果
        if (result && result.trim()) {
          this.addTerminalLine('output', result);
        } else {
          this.addTerminalLine('output', '命令执行完成，无输出');
        }
        
      } catch (error: any) {
        console.error('命令执行失败:', error);
        this.addTerminalLine('error', `执行失败: ${error.message || '未知错误'}`);
      } finally {
        this.isExecuting = false;
      }
    },
    
    // 处理cd命令
    async handleCdCommand(args: string[]) {
      let targetPath = '';
      
      if (args.length === 0) {
        // cd without arguments goes to home directory
        targetPath = '~';
      } else {
        targetPath = args[0];
      }
      
      try {
        // 构建完整的cd命令
        let cdCommand = '';
        if (targetPath === '~') {
          cdCommand = 'cd ~ && pwd';
        } else if (targetPath.startsWith('/')) {
          // 绝对路径
          cdCommand = `cd "${targetPath}" && pwd`;
        } else {
          // 相对路径
          cdCommand = `cd "${this.currentDir}/${targetPath}" && pwd`;
        }
        
        // 执行cd命令并获取新目录
        const result = await Shell.exec(cdCommand);
        const newDir = result.trim();
        
        // 更新当前目录
        this.currentDir = newDir;
        
        // 显示新目录（pwd的输出）
        this.addTerminalLine('output', newDir);
        
      } catch (error: any) {
        this.addTerminalLine('error', `cd: ${error.message || '无法切换目录'}`);
        
        // 尝试其他方式
        if (targetPath.startsWith('/')) {
          // 已经是绝对路径，尝试直接切换
          try {
            const result = await Shell.exec(`cd ${targetPath} && pwd`);
            this.currentDir = result.trim();
            this.addTerminalLine('output', this.currentDir);
          } catch (e: any) {
            this.addTerminalLine('error', `cd: 无法切换到目录 "${targetPath}"`);
          }
        }
      }
    },
    
    // 测试Shell功能
    async testShell() {
      if (!this.shellInitialized || !Shell) {
        this.addTerminalLine('error', 'Shell模块未初始化');
        return;
      }
      
      this.addTerminalLine('system', '开始Shell功能测试...');
      
      const testCommands = [
        { cmd: 'echo "Shell测试成功"', desc: '基本echo命令' },
        { cmd: 'ls', desc: '当前目录列表' },
        { cmd: 'pwd', desc: '当前路径' },
        { cmd: 'cd / && pwd', desc: '切换到根目录并显示' },
        { cmd: 'mkdir test_folder_123', desc: '创建测试文件夹' },
        { cmd: 'ls', desc: '检查文件夹是否创建' },
        { cmd: 'cd / && pwd', desc: '切换回根目录' },
      ];
      
      for (const test of testCommands) {
        try {
          // 对于cd命令，特殊处理
          if (test.cmd.startsWith('cd')) {
            const args = test.cmd.replace('cd ', '').split(' && ');
            await this.handleCdCommand(args[0].split(' '));
            continue;
          }
          
          const result = await Shell.exec(`cd "${this.currentDir}" && ${test.cmd}`);
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
clear         清空终端显示
history       显示命令历史
reset         重置终端
test          测试Shell功能
vi <文件>     编辑文本文件 (使用内置编辑器)
passwd        修改用户密码 (模拟Linux交互式修改)

=== 真实Shell命令 ===
所有Linux命令都可以直接执行：

文件操作:
  ls            列出文件
  ls -la        详细文件列表
  cd [目录]     切换目录（现在真正生效）
  pwd           显示当前目录
  cat [文件]    查看文件
  mkdir [目录]  创建目录
  rm [文件]     删除文件
  touch [文件]  创建文件
  vi <文件>     编辑文件 (会跳转到文本编辑器)

系统管理:
  passwd        修改密码 (交互式)
  mount         挂载文件系统
  df -h         磁盘使用情况
  free -m       内存使用情况

系统信息:
  ps aux        查看进程
  uname -a      系统信息
  date          日期时间
  neofetch      系统信息

网络工具:
  ping [主机]   网络连通性测试
  curl [URL]    下载文件
  wget [URL]    下载文件

安装应用:
  miniapp_cli install [amr文件]  安装应用

注意: 
- passwd命令会模拟Linux的交互式密码修改
- 密码输入不会显示在屏幕上（显示为*）
- 系统会自动使用openssl生成加密密码并更新

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
      this.currentDir = '/';
      this.passwdInProgress = false;
      this.passwdStep = 0;
      this.addTerminalLine('system', '终端已重置');
      this.initializeShell();
    },
    
    // 清空终端
    clearTerminal() {
      this.terminalLines = [];
      this.passwdInProgress = false;
      this.passwdStep = 0;
      this.addTerminalLine('system', '终端已清空');
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
      if (this.passwdInProgress) {
        this.addTerminalLine('system', '密码修改已取消');
        this.passwdInProgress = false;
        this.passwdStep = 0;
        this.inputText = '';
        return;
      }
      
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
