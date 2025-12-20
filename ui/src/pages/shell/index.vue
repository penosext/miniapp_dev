<!--
 Copyright (C) 2025 Langning Chen
 
 This file is part of miniapp.
 
 miniapp is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 
 miniapp is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.
 
 You should have received a copy of the GNU General Public License
 along with miniapp.  If not, see <https://www.gnu.org/licenses/>.
-->

<template>
  <div class="container">
    <!-- 终端输出区域 -->
    <scroller 
      class="output-scroller"
      ref="scroller"
      scroll-direction="vertical"
      :show-scrollbar="true"
    >
      <div v-for="(item, index) in history" :key="index">
        <text :class="['output-line', getHistoryClass(item)]">{{ item.content }}</text>
      </div>
      
      <!-- 当前命令行提示 -->
      <div class="command-prompt" v-if="!isExecuting">
        <text class="prompt">{{ currentDir }} $</text>
        <text class="cursor">█</text>
      </div>
      
      <!-- 执行中提示 -->
      <div class="executing-prompt" v-else>
        <text class="loading">执行中...</text>
        <text class="blinking-cursor">█</text>
      </div>
    </scroller>

    <!-- 输入区域 -->
    <div class="input-bar">
      <div class="input-container" @click="openKeyboard">
        <text class="input-text">{{ inputCommand || '点击输入命令...' }}</text>
      </div>
      
      <!-- 按钮组 -->
      <div class="btn-group">
        <text 
          class="btn run-btn" 
          @click="executeCommand"
          :class="{ 'btn-disabled': isExecuting || !inputCommand.trim() }"
        >{{ isExecuting ? '执行中' : '执行' }}</text>
        <text 
          class="btn clear-btn" 
          @click="clearTerminal"
          :class="{ 'btn-disabled': isExecuting }"
        >清屏</text>
      </div>
    </div>
    
    <!-- 快速命令按钮 -->
    <div class="quick-commands" v-if="!isExecuting">
      <text class="quick-title">快速命令:</text>
      <div v-for="cmd in quickCommands" :key="cmd.label">
        <text 
          class="quick-btn"
          @click="executeQuickCommand(cmd.command)"
        >{{ cmd.label }}</text>
      </div>
    </div>
  </div>
</template>

<style lang="less" scoped>
@import url('./index.less');
</style>

<script>
import shell from './index';
import ToastMessage from '../../components/ToastMessage.vue';
export default {
  ...shell,
  components: {
    ToastMessage
  }
}
</script>