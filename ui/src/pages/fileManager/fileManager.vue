<template>
  <div>
    <scroller class="container" scroll-direction="vertical" :show-scrollbar="true">
      <div class="section">
        <text class="section-title">文件管理器</text>
        <div class="item">
          <text class="item-text">当前路径:</text>
          <text class="file-path">{{ currentPath }}</text>
          <text @click="goBack" :class="'btn' + (canGoBack ? ' btn-primary' : ' btn-disabled')">返回上级</text>
        </div>
        <div class="item">
          <text class="item-text">搜索文件:</text>
          <text class="item-input" @click="searchFiles">{{ searchKeyword || '点击搜索文件...' }}</text>
          <text v-if="searchKeyword" @click="clearSearch" class="btn btn-danger">清除</text>
        </div>
        <div class="item">
          <text class="item-text">统计信息:</text>
          <text class="file-stats">{{ totalFiles }} 个项目, {{ formatSize(totalSize) }}</text>
          <text @click="toggleHiddenFiles" :class="'btn' + (showHiddenFiles ? ' btn-warning' : '')">
            {{ showHiddenFiles ? '隐藏' : '显示' }}隐藏文件
          </text>
        </div>
      </div>

      <div class="section">
        <text class="section-title">文件操作</text>
        <div class="operations-grid">
          <text @click="createNewFile" class="operation-btn operation-btn-success">新建文件</text>
          <text @click="createNewDirectory" class="operation-btn operation-btn-success">新建目录</text>
          <text @click="refreshDirectory" class="operation-btn operation-btn-primary">刷新目录</text>
          <text @click="$falcon.navTo('index', {})" class="operation-btn">返回主页</text>
        </div>
      </div>

      <div class="section">
        <text class="section-title">文件列表</text>
        <div v-if="filteredFiles.length===0" class="file-empty">
          <text class="empty-title">目录为空</text>
          <text v-if="searchKeyword" class="empty-description">没有找到匹配文件</text>
          <text v-else class="empty-description">点击上方按钮创建文件或目录</text>
        </div>

        <div v-for="file in filteredFiles" :key="file.fullPath" class="file-item">
          <text :class="getFileIconClass(file)">{{ file.icon }}</text>
          <text class="file-name">{{ file.name }}</text>
          <text class="file-size">{{ file.sizeFormatted }}</text>
          <text class="file-date">{{ file.modifiedTimeFormatted }}</text>
          <div class="file-actions">
            <text @click.stop="renameItem(file)" class="btn btn-warning">重命名</text>
            <text @click.stop="deleteItem(file)" class="btn btn-danger">删除</text>
            <text @click.stop="openItem(file)" class="btn btn-primary">打开/进入</text>
            <text @click.stop="copyFilePath(file)" class="btn btn-info">复制路径</text>
            <text @click.stop="showFileProperties(file)" class="btn btn-secondary">属性</text>
          </div>
        </div>
      </div>
    </scroller>

    <modal v-if="showConfirmModal" :title="confirmTitle" @ok="executeConfirmAction" @cancel="cancelConfirmAction">
      <text>{{ confirmMessage }}</text>
    </modal>
  </div>
</template>

<script lang="ts" src="./fileManager.ts"></script>

<style lang="less" src="./fileManager.less"></style>
