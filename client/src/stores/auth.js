import { reactive, computed } from 'vue'

const state = reactive({
  username: sessionStorage.getItem('auth_username') || '',
  password: sessionStorage.getItem('auth_password') || ''
})

const isAuthenticated = computed(() => {
  return !!(state.username && state.password)
})

function login(username, password) {
  state.username = username
  state.password = password
  sessionStorage.setItem('auth_username', username)
  sessionStorage.setItem('auth_password', password)
}

function logout() {
  state.username = ''
  state.password = ''
  sessionStorage.removeItem('auth_username')
  sessionStorage.removeItem('auth_password')
}

function getAuthHeader() {
  if (!state.username || !state.password) {
    return ''
  }
  const encoded = btoa(state.username + ':' + state.password)
  return 'Basic ' + encoded
}

export { state, isAuthenticated, login, logout, getAuthHeader }
