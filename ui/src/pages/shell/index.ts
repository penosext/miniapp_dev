// 在 executeRealCommand 方法中添加输出处理增强
async executeRealCommand(command: string) {
  this.isExecuting = true;
  
  try {
    // 首先切换到当前目录，然后执行命令
    let fullCommand = command;
    if (this.currentDir !== '/' && this.currentDir !== '') {
      // 在指定目录下执行命令
      fullCommand = `cd "${this.currentDir}" && ${command} 2>&1`;
    }
    
    const startTime = Date.now();
    const result = await Shell.exec(fullCommand);
    const duration = Date.now() - startTime;
    
    // 处理输出结果，增强可读性
    if (result && result.trim()) {
      // 对输出进行格式化处理
      const formattedResult = this.formatOutput(result, command);
      this.addTerminalLine('output', formattedResult);
      this.addTerminalLine('success', `✓ 命令执行成功 (${duration}ms)`);
    } else {
      this.addTerminalLine('output', '命令执行完成，无输出');
      this.addTerminalLine('success', `✓ 命令执行成功 (${duration}ms)`);
    }
    
  } catch (error: any) {
    console.error('命令执行失败:', error);
    
    // 提取有用的错误信息
    const errorMsg = error.message || '未知错误';
    this.addTerminalLine('error', `执行失败: ${errorMsg}`);
    
    // 提供有用的提示
    if (errorMsg.includes('permission denied')) {
      this.addTerminalLine('warning', '提示: 权限不足，可能需要root权限');
    } else if (errorMsg.includes('not found')) {
      this.addTerminalLine('warning', '提示: 命令不存在或路径错误');
    } else if (errorMsg.includes('No such file or directory')) {
      this.addTerminalLine('warning', '提示: 文件或目录不存在');
    } else if (errorMsg.includes('command not found')) {
      this.addTerminalLine('warning', '提示: 命令未找到，请检查命令拼写或安装相应工具');
    }
  } finally {
    this.isExecuting = false;
  }
},

// 添加格式化输出方法
formatOutput(output: string, command: string): string {
  // 如果是ls命令的输出，尝试添加颜色提示
  if (command.startsWith('ls') || command.includes('| grep')) {
    return this.colorizeLsOutput(output);
  }
  
  // 如果是df命令的输出，添加分隔线
  if (command.startsWith('df')) {
    return this.formatDfOutput(output);
  }
  
  // 如果是ps命令的输出，添加表头
  if (command.startsWith('ps')) {
    return this.formatPsOutput(output);
  }
  
  // 默认返回原始输出
  return output;
},

// 为ls输出添加颜色提示（通过添加标识符，CSS会处理）
colorizeLsOutput(output: string): string {
  const lines = output.split('\n');
  const coloredLines = lines.map(line => {
    // 识别目录（以/结尾或以drwx开头）
    if (line.endsWith('/') || line.startsWith('drwx')) {
      return line; // CSS中的.dir类会处理
    }
    // 识别可执行文件（包含*或x权限）
    if (line.includes('*') || /^[-rwx]+.*x/.test(line)) {
      return line; // CSS中的.executable类会处理
    }
    // 识别符号链接（包含->）
    if (line.includes('->')) {
      return line; // CSS中的.symlink类会处理
    }
    // 普通文件
    return line; // CSS中的.file类会处理
  });
  
  return coloredLines.join('\n');
},

// 格式化df输出
formatDfOutput(output: string): string {
  const lines = output.split('\n');
  if (lines.length > 0) {
    // 添加表头分隔线
    const headerLine = lines[0];
    const separator = '─'.repeat(headerLine.length);
    lines.splice(1, 0, separator);
    return lines.join('\n');
  }
  return output;
},

// 格式化ps输出
formatPsOutput(output: string): string {
  const lines = output.split('\n');
  if (lines.length > 0) {
    // 为表头添加下划线
    const headerLine = lines[0];
    const separator = '─'.repeat(headerLine.length);
    lines.splice(1, 0, separator);
    return lines.join('\n');
  }
  return output;
},
