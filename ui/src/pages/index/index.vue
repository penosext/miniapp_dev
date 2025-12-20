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
        <!-- 输出区域：移除 @ready，依赖 updated 钩子 -->
        <scroller ref="outputScroller" class="output-area" scroll-direction="vertical" :show-scrollbar="true">
            <text class="output-text">{{ output || '$ 正在初始化 Shell...' }}</text>
        </scroller>

        <!-- 输入栏 -->
        <div class="input-bar">
            <text class="prompt">$</text>
            <!-- 文本显示区域 -->
            <text class="item-input" @click="openSoftKeyboardForCommand">{{ 
                commandInput.length > 0 ? commandInput : '请输入 Shell 命令...' 
            }}</text>
            
            <div class="btn-group">
                <!-- 执行按钮：绑定到 executeCommand -->
                <text @click="executeCommand" 
                      :class="'btn run-btn' + (executing ? ' square-btn-disabled' : '')">执行</text>
                
                <text @click="clearOutput" class="btn clear-btn">清空</text>
            </div>
        </div>
        
        <!-- 导航按钮（保持原样） -->
        <div class="section" style="background-color: #1a1a1a; padding: 5px;">
            <div class="item">
                <text class="item-text" @click="openAi">AI 助手</text>
            </div>
            <div class="item">
                <text class="item-text" @click="shelldebug">调试更新</text>
            </div>
        </div>
    </div>
    <ToastMessage />
</template>

<style lang="less" scoped>
@import url('index.less');
</style>

<script>
import index from './index';
import ToastMessage from '../../components/ToastMessage.vue';

export default {
    // 注意这里不能使用 ...index, 否则会覆盖 or 合并 methods 导致问题，直接展开 data/methods/computed
    // 假设 index.ts 导出的是 default export { data, methods, ... }
    // 我们直接使用 index.default 的内容
    data() { return index.default.data ? index.default.data.call(this) : {} },
    methods: {
        ...index.default.methods,
        
        // 覆盖或确保 index.ts 中新增的方法被正确绑定到组件实例
        executeCommand() { index.default.methods.executeCommand.call(this); },
        clearOutput() { index.default.methods.clearOutput.call(this); },
        openSoftKeyboardForCommand() { index.default.methods.openSoftKeyboardForCommand.call(this); },
    },
    components: {
        ToastMessage
    },
    
    // 关键：在输出内容更新后，尝试滚动到底部
    updated() {
        const scroller = this.$refs.outputScroller;
        // 检查 scroller 实例是否存在并且有滚动到底部的方法
        if (scroller && scroller.scrollToEnd) {
            this.$nextTick(() => {
                scroller.scrollToEnd();
            });
        }
    },
    
    // 确保 mounted 时执行初始化逻辑
    mounted() {
        if (index.default.mounted) {
            index.default.mounted.call(this);
        }
    },
    
    beforeDestroy() {
        if (index.default.beforeDestroy) {
            index.default.beforeDestroy.call(this);
        }
    }
};
</script>
