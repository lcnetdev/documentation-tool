<template>
  <div id="documentation-app">
    <router-view />
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style>
#documentation-app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
