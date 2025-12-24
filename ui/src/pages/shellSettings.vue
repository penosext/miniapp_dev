<template>
  <div class="shell-settings">
    <div class="header">Shell 脚本管理</div>

    <div v-if="scripts.length === 0" class="empty">
      <div class="create-btn" @click="createScript">+ 新建脚本</div>
    </div>

    <div v-for="s in scripts" :key="s.name" class="script-row">
      <div class="script-left">
        <text class="script-name">{{ s.name }}</text>
      </div>
      <div class="script-right">
        <text v-if="!s.enabled" class="btn" @click="enable(s)">启用</text>
        <text v-else class="btn danger" @click="disable(s)">停用</text>
      </div>
    </div>

    <div v-if="scripts.length > 0" class="add-more" @click="createScript">
      + 新建脚本
    </div>
  </div>
</template>

<style lang="less" scoped>
@import './shellSettings.less';
</style>

<script>
import shellSettings from './shellSettings';
export default shellSettings;
</script>
