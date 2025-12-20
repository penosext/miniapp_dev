<template>
  <div class="container">
    <!-- 终端输出区域 -->
    <div class="terminal-content">
      <scroller 
        class="terminal-scroller"
        ref="terminalScroller"
        scroll-direction="vertical"
        :show-scrollbar="true"
      >
        <div v-for="line in terminalLines" :key="line.id" class="terminal-line">
          <!-- 使用pre标签保持格式，text组件处理文本 -->
          <text :class="['line-text', line.type]">{{ line.content }}</text>
        </div>
        
        <!-- 命令提示符 -->
        <div class="command-prompt">
          <text class="prompt">{{ currentDir }} $</text>
          <text v-if="!isExecuting" class="cursor">█</text>
          <text v-else class="loading">⌛ 执行中...</text>
        </div>
      </scroller>
    </div>

    <!-- 快速命令区域 -->
    <div class="quick-commands-section">
      <text class="section-title">快速命令 (左右滑动查看更多)</text>
      <scroller 
        class="quick-commands-container"
        scroll-direction="horizontal"
        :show-scrollbar="true"
      >
        <div 
          v-for="cmd in quickCommands"
          :key="cmd.id"
          class="quick-command"
          @click="executeQuickCommand(cmd.command)"
        >
          <text class="quick-label">{{ cmd.label }}</text>
          <text class="quick-desc">{{ cmd.description }}</text>
        </div>
      </scroller>
    </div>

    <!-- 输入区域 -->
    <div class="input-section">
      <div class="input-container" @click="openKeyboard">
        <text class="input-text">{{ inputText || '点击这里输入命令...' }}</text>
      </div>
      
      <div class="action-buttons">
        <text 
          class="btn btn-execute"
          :class="{ 'btn-disabled': !canExecute }"
          @click="executeCommand"
        >
          执行
        </text>
        <text 
          class="btn btn-clear"
          @click="clearTerminal"
        >
          清屏
        </text>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
@import url('./index.less');
</style>

<script>
import shell from './index';
export default shell;
</script>
