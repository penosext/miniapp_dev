<template>
  <div class="editor-container">
    <!-- 标题栏 -->
    <div class="editor-header">
      <text class="header-title">{{ fileName }}</text>
      <div class="header-actions">
        <text v-if="isModified" style="color: #ffc107; font-size: 12px;">已修改</text>
        <text @click="exitEditor" class="toolbar-btn toolbar-btn-danger">关闭</text>
      </div>
    </div>
    
    <!-- 编辑区域 -->
    <div class="editor-content">
      <!-- 行号 -->
      <div class="line-numbers">
        <text v-for="lineNum in lineNumbers" :key="lineNum" class="line-number">
          {{ lineNum }}
        </text>
      </div>
      
      <!-- 文本编辑区域 -->
      <textarea class="editor-textarea" ref="textarea"
                v-model="fileContent"
                @input="onContentChange"
                placeholder="在此输入文本..."
                spellcheck="false"
                autocorrect="off"
                autocapitalize="off">
      </textarea>
    </div>
    
    <!-- 状态栏 -->
    <div class="editor-status">
      <text class="status-item status-cursor">{{ fileStats }}</text>
      <text class="status-item status-size">{{ getFileInfo() }}</text>
      <text v-if="isModified" class="status-item" style="color: #ffc107;">已修改</text>
    </div>
    
    <!-- 工具栏 -->
    <div class="editor-toolbar">
      <text @click="openKeyboard" class="toolbar-btn">键盘</text>
      <text @click="saveFile" :class="'toolbar-btn' + (canSave ? ' toolbar-btn-success' : '')" 
            :style="{ opacity: canSave ? 1 : 0.5 }">保存</text>
      <text @click="showSaveAsDialog" class="toolbar-btn toolbar-btn-warning">另存为</text>
      <text @click="clearContent" class="toolbar-btn toolbar-btn-danger">清空</text>
    </div>
    
    <!-- 查找对话框 -->
    <div v-if="showFindModal" class="editor-modal">
      <text class="modal-title">查找文本</text>
      <div class="modal-content">
        <input type="text" class="modal-input" v-model="findText" placeholder="输入要查找的文本" />
        <text v-if="findResults.length > 0" style="color: #28a745; font-size: 14px;">
          找到 {{ findResults.length }} 个匹配项
        </text>
      </div>
      <div class="modal-buttons">
        <text @click="performFind" class="toolbar-btn toolbar-btn-success">查找</text>
        <text @click="showFindModal = false" class="toolbar-btn toolbar-btn-danger">取消</text>
      </div>
    </div>
    
    <!-- 确认对话框 -->
    <div v-if="showConfirmModal" class="save-confirm">
      <text class="confirm-title">{{ confirmTitle }}</text>
      <div class="confirm-buttons">
        <text @click="executeConfirmAction(confirmAction)" class="toolbar-btn toolbar-btn-danger">确定</text>
        <text @click="showConfirmModal = false" class="toolbar-btn">取消</text>
      </div>
    </div>
    
    <Loading />
    <ToastMessage />
  </div>
</template>