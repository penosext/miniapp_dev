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
    <!-- 标题栏 -->
    <div class="header">
      <text class="title">📱 设备信息查看器</text>
      <div 
        class="refresh-btn" 
        @click="refreshInfo"
        :class="{ loading: isRefreshing }"
      >
        <text class="refresh-text" :class="{ loading: isRefreshing }">
          {{ isRefreshing ? '刷新中...' : '刷新' }}
        </text>
      </div>
    </div>

    <!-- 设备信息显示区域 -->
    <div class="info-content">
      <scroller 
        class="info-scroller"
        scroll-direction="vertical"
        :show-scrollbar="true"
      >
        <!-- 加载状态 -->
        <div v-if="isLoading" class="loading-container">
          <text class="loading-text">正在加载设备信息...</text>
        </div>
        
        <!-- 错误信息 -->
        <div v-else-if="deviceInfo.error" class="info-section">
          <text class="section-title">❌ 错误信息</text>
          <div class="info-item">
            <text class="item-value error-value">{{ deviceInfo.error }}</text>
          </div>
        </div>
        
        <!-- 正常显示设备信息 -->
        <div v-else>
          <!-- IP地址信息 -->
          <div class="info-section">
            <text class="section-title">🌐 IP地址信息</text>
            <div class="info-item">
              <text class="item-label">IP地址:</text>
              <text class="item-value">{{ formatIP(deviceInfo.ipAddress || '') }}</text>
            </div>
          </div>
          
          <!-- 设备标识 -->
          <div class="info-section">
            <text class="section-title">🆔 设备标识</text>
            <div class="info-item">
              <text class="item-label">设备ID:</text>
              <text class="item-value">{{ deviceInfo.deviceId || '未知' }}</text>
            </div>
          </div>
          
          <!-- 系统信息 -->
          <div class="info-section">
            <text class="section-title">💻 系统信息</text>
            <div class="info-item">
              <text class="item-label">设备型号:</text>
              <text class="item-value">{{ deviceInfo.systemInfo?.model || '未知' }}</text>
            </div>
            <div class="info-item">
              <text class="item-label">内核版本:</text>
              <text class="item-value">{{ deviceInfo.systemInfo?.kernel || '未知' }}</text>
            </div>
            <div class="info-item">
              <text class="item-label">系统版本:</text>
              <text class="item-value">{{ deviceInfo.systemInfo?.version || '未知' }}</text>
            </div>
          </div>
          
          <!-- 存储信息 -->
          <div class="info-section">
            <text class="section-title">💾 存储信息</text>
            <div class="info-item">
              <text class="item-label">总空间:</text>
              <text class="item-value">{{ deviceInfo.storageInfo?.total || '未知' }}</text>
            </div>
            <div class="info-item">
              <text class="item-label">已使用:</text>
              <text class="item-value">{{ deviceInfo.storageInfo?.used || '未知' }}</text>
            </div>
            <div class="info-item">
              <text class="item-label">可用空间:</text>
              <text class="item-value">{{ deviceInfo.storageInfo?.free || '未知' }}</text>
            </div>
          </div>
          
          <!-- 网络接口详情 -->
          <div class="info-section" v-if="deviceInfo.networkInfo?.interfaces && deviceInfo.networkInfo.interfaces !== '获取失败'">
            <text class="section-title">📡 网络接口详情</text>
            <div class="info-item">
              <text class="item-value">{{ deviceInfo.networkInfo?.interfaces || '无网络接口信息' }}</text>
            </div>
          </div>
          
          <!-- 时间戳 -->
          <div class="info-section">
            <text class="section-title">🕐 信息更新时间</text>
            <div class="info-item">
              <text class="item-label">最后更新:</text>
              <text class="item-value">{{ new Date(deviceInfo.timestamp || Date.now()).toLocaleString() }}</text>
            </div>
          </div>
        </div>
      </scroller>
    </div>

    <!-- 底部信息 -->
    <div class="footer">
      <text class="copyright">© 2025 设备信息查看器 - 基于 langningchen.Shell</text>
    </div>
  </div>
</template>

<style lang="less" scoped>
@import url('deviceinfo.less');
</style>

<script>
import deviceinfo from './deviceinfo';
export default deviceinfo;
</script>